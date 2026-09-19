import "./style.css";
import Phaser from "phaser";

import { initAudio } from "./audio";
import { loadContent } from "./content";
import { Dialogue } from "./dialogue";
import { Mastery } from "./mastery";
import { getLast, listProfiles, saveProfile, type Profile } from "./profile";
import { GRASS_HEX } from "./textures";
import { chapterCard, chooseProfile, EnginePanel, fatal, Hud, setPrompt } from "./ui";
import { WorldScene, type WorldDeps } from "./world";

const CHAPTER = 1;

async function boot(): Promise<void> {
  const stage = document.getElementById("stage")!;

  await initAudio();

  const content = await loadContent(CHAPTER);
  const pool = content.chapter.shengzi;

  // Resume the player who was last here; the masthead has a switch for shared devices.
  const lastId = getLast();
  const known = listProfiles();
  let profile: Profile | undefined = known.find((p) => p.id === lastId);
  if (!profile) profile = await chooseProfile(pool);

  const mastery = new Mastery(profile.mastery, pool, content.chars);

  // Counters are part of saved progress: resuming in the orchard must not hand
  // back the five donkeys the keeper has not returned yet.
  const counters: Record<string, number> = { ...content.chapter.counters, ...(profile.counters ?? {}) };

  const hud = new Hud(profile, content.chapter, counters);
  hud.setAudioLabel();
  window.setTimeout(() => hud.setAudioLabel(), 1200);

  const panel = new EnginePanel(mastery, content.chars, content.chapter, counters, profile);
  panel.render();

  const save = () => {
    profile!.counters = counters;
    saveProfile(profile!);
  };

  const dialogue = new Dialogue(stage, content.chars, {
    coins: () => profile!.coins,
    addCoins: (n) => {
      profile!.coins = Math.max(0, profile!.coins + n);
      hud.refresh();
      panel.render();
    },
    phonetics: () => profile!.phonetics,
  });

  const deps: WorldDeps = {
    chapter: content.chapter,
    chars: content.chars,
    profile,
    mastery,
    dialogue,
    counters,
    save,
    refreshHud: () => {
      hud.refresh();
      panel.render();
    },
    setPrompt: (name) => setPrompt(stage, name),
    onSceneChange: (i) => {
      hud.setScene(i);
      panel.render();
    },
    onQuestion: (q, speaker) => panel.note(q, speaker),
    onChapterComplete: (summary) => chapterCard(content.chapter, summary, profile!),
  };

  const startIndex = Math.min(profile.sceneIndex ?? 0, content.chapter.scenes.length - 1);

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "stage",
    width: 800,
    height: 480,
    backgroundColor: GRASS_HEX,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.NO_CENTER },
    scene: [WorldScene],
  });
  game.scene.start("world", { deps, index: startIndex });

  // Dev-only handle, for driving the scene from the console while building.
  if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__game = game;

  // Touch pad, for a tablet in landscape.
  const pad = document.getElementById("pad")!;
  if (window.matchMedia("(pointer: coarse)").matches) pad.classList.add("on");
  pad.querySelectorAll<HTMLButtonElement>("button").forEach((b) => {
    const dir = b.dataset.dir as "left" | "right" | "up" | "down";
    const set = (on: boolean) => (e: Event) => {
      e.preventDefault();
      const scene = game.scene.getScene("world") as WorldScene | null;
      scene?.setPad(dir, on);
    };
    b.addEventListener("pointerdown", set(true));
    b.addEventListener("pointerup", set(false));
    b.addEventListener("pointerleave", set(false));
    b.addEventListener("pointercancel", set(false));
  });

  document.getElementById("btn-profile")!.addEventListener("click", () => {
    save();
    void chooseProfile(pool).then((p) => {
      // Simplest correct switch: persist, then reload as the chosen player.
      saveProfile(p);
      location.reload();
    });
  });

  window.addEventListener("beforeunload", save);
}

boot().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  fatal(`Could not start: ${message}`);
  // eslint-disable-next-line no-console
  console.error(err);
});
