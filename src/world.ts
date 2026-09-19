import Phaser from "phaser";
import { Encounters } from "./encounters";
import { bakeGround, buildTextures, TS } from "./textures";
import type { ActorSpec, ChapterSpec, CharMap, Question, SceneSpec, YExpr } from "./types";
import type { Dialogue } from "./dialogue";
import type { Mastery } from "./mastery";
import type { Profile } from "./profile";

export interface WorldDeps {
  chapter: ChapterSpec;
  chars: CharMap;
  profile: Profile;
  mastery: Mastery;
  dialogue: Dialogue;
  counters: Record<string, number>;
  save: () => void;
  refreshHud: () => void;
  setPrompt: (text: string | null) => void;
  onSceneChange: (index: number) => void;
  onQuestion: (q: Question | null, speaker: string) => void;
  onChapterComplete: (summary: ChapterSummary) => void;
}

export interface ChapterSummary {
  party: string[];
  coins: number;
  /** mastery >= 4: four unaided correct answers, so normally zero after one pass */
  learned: number;
  /** seen at least once this chapter */
  practised: number;
  total: number;
}

interface Follower {
  sprite: Phaser.GameObjects.Image;
  lag: number;
}

const SPEED = 132;
const TALK_RANGE = 80;

/**
 * The dialogue box covers the lower third of the frame. While it is open the
 * camera lifts, so the player and the herd trailing behind stay in view: a world
 * question ("how many donkeys?") is only answerable if you can still see them.
 */
const TALK_CAM_LIFT = 118;

export class WorldScene extends Phaser.Scene {
  private deps!: WorldDeps;
  private spec!: SceneSpec;
  private sceneIndex = 0;

  private solid = new Set<string>();
  private wallTiles = new Map<number, string[]>();
  private player!: Phaser.GameObjects.Image;
  private trail: { x: number; y: number }[] = [];
  private followers: Follower[] = [];
  private actors: { spec: ActorSpec; sprite: Phaser.GameObjects.Image; bang?: Phaser.GameObjects.Image; done: boolean }[] = [];
  private propSprites: { sprite: Phaser.GameObjects.Image; counter?: string; index: number }[] = [];
  private wallSprites = new Map<number, Phaser.GameObjects.Image[]>();

  private enc!: Encounters;
  private busy = false;
  private leaving = false;
  private near: ActorSpec | null = null;
  private keys!: {
    cursors: Phaser.Types.Input.Keyboard.CursorKeys;
    wasd: Record<string, Phaser.Input.Keyboard.Key>;
  };
  private pad = { left: false, right: false, up: false, down: false };
  private party: string[] = [];

  constructor() {
    super("world");
  }

  init(data: { deps: WorldDeps; index: number }): void {
    this.deps = data.deps;
    this.sceneIndex = data.index;
    this.spec = data.deps.chapter.scenes[data.index];
    this.solid = new Set();
    this.wallTiles = new Map();
    this.wallSprites = new Map();
    this.followers = [];
    this.actors = [];
    this.propSprites = [];
    this.trail = [];
    this.busy = false;
    this.leaving = false;
    this.near = null;
  }

  // ---- map helpers --------------------------------------------------------

  private pathY(x: number): number {
    const p = this.spec.map.path;
    return Math.round(p.base + p.amp * Math.sin(x / p.period));
  }

  private isPath(x: number, y: number): boolean {
    const top = this.pathY(x);
    return y >= top && y < top + this.spec.map.path.width;
  }

  /** "path", "path-3", "path+2" or an absolute row. */
  private resolveY(y: YExpr, x: number): number {
    if (typeof y === "number") return y;
    const m = /^path(?:\s*([+-])\s*(\d+))?$/.exec(y.trim());
    if (!m) return Number(y) || 0;
    const base = this.pathY(x);
    if (!m[1]) return base;
    return m[1] === "-" ? base - Number(m[2]) : base + Number(m[2]);
  }

  private blocked(x: number, y: number): boolean {
    const { w, h } = this.spec.map;
    if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) return true;
    return this.solid.has(`${x},${y}`);
  }

  private addSolid(x: number, y: number): void {
    this.solid.add(`${x},${y}`);
  }

  private place(kind: string, x: number, yTile: number, depthBias = 2): Phaser.GameObjects.Image {
    const img = this.add
      .image(x * TS + TS / 2, yTile * TS + TS, kind)
      .setOrigin(0.5, 1)
      .setDepth(yTile * TS + depthBias);
    return img;
  }

  // ---- build --------------------------------------------------------------

  create(): void {
    buildTextures(this);
    this.enc = new Encounters(this.deps.chapter, this.deps.chars, this.deps.mastery, this.deps.counters);
    const { w, h } = this.spec.map;

    const groundKey = `ground:${this.deps.chapter.chapter}:${this.spec.id}`;
    bakeGround(this, groundKey, w, h, (x, y) => this.isPath(x, y));
    this.add.image(0, 0, groundKey).setOrigin(0, 0).setDepth(0);

    // border of trees, and the tile ring is solid via blocked()
    for (let x = 0; x < w; x++) {
      this.place("tree", x, 0, 1);
      this.place("tree", x, h - 1, 1);
    }
    for (let y = 1; y < h - 1; y++) {
      this.place("tree", 0, y, 1);
      this.place("tree", w - 1, y, 1);
    }

    // verge trees
    this.spec.map.treeXs.forEach((x, i) => {
      const py = this.pathY(x);
      const above = py - 2 - (i % 2);
      const below = py + this.spec.map.path.width + 1 + ((i + 1) % 2);
      const kind = this.spec.id === "orchard" ? "fruittree" : "tree";
      if (above > 0) {
        this.place(kind, x, above);
        this.addSolid(x, above);
      }
      if (below < h - 1) {
        this.place(kind, x, below);
        this.addSolid(x, below);
      }
    });

    // walls: a full column, so the road really is blocked and cannot be walked round
    for (const wall of this.spec.map.walls) {
      const sprites: Phaser.GameObjects.Image[] = [];
      const gap: string[] = [];
      for (let y = 1; y < h - 1; y++) {
        this.addSolid(wall.x, y);
        if (this.isPath(wall.x, y)) {
          gap.push(`${wall.x},${y}`); // held by the actor standing here
        } else {
          sprites.push(this.place(wall.kind, wall.x, y));
        }
      }
      this.wallTiles.set(wall.x, gap);
      this.wallSprites.set(wall.x, sprites);
    }

    // scenery
    for (const f of this.spec.map.features) {
      const y = this.resolveY(f.y, f.x);
      this.place(f.kind, f.x, y);
      if (f.kind !== "crate") this.addSolid(f.x, y);
    }

    // props that reflect a counter (the squirrels you are asked to count)
    for (const p of this.spec.props) {
      p.at.forEach(([x, yExpr], i) => {
        const y = this.resolveY(yExpr, x);
        const s = this.place(p.sprite, x, y, 6).setDepth(9500);
        this.propSprites.push({ sprite: s, counter: p.counter, index: i });
      });
    }

    // player
    const sx = this.spec.spawn.x;
    const sy = this.resolveY(this.spec.spawn.y, sx);
    const px = sx * TS + TS / 2;
    const py = sy * TS + TS;
    this.player = this.add.image(px, py, `kid${this.deps.profile.avatar % 4}`).setOrigin(0.5, 1).setDepth(py);
    for (let i = 0; i < 600; i++) this.trail.push({ x: px, y: py });

    // actors
    for (const a of this.spec.actors) {
      const ay = this.resolveY(a.y, a.x);
      if (a.follows) {
        const s = this.add.image(px, py, a.sprite).setOrigin(0.5, 1).setDepth(py);
        this.followers.push({ sprite: s, lag: 14 });
        continue;
      }
      const sprite = this.place(a.sprite, a.x, ay, 4);
      let bang: Phaser.GameObjects.Image | undefined;
      if (a.script?.length) {
        bang = this.add.image(sprite.x, sprite.y - 54, "bang").setDepth(9999);
        this.tweens.add({
          targets: bang,
          y: bang.y - 6,
          duration: 620,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
      }
      this.actors.push({ spec: a, sprite, bang, done: false });
      if (a.blocksWall !== undefined) {
        for (const t of this.wallTiles.get(a.blocksWall) ?? []) this.solid.add(t);
      }
    }

    // the donkey train
    this.syncDonkeys();
    this.refreshProps();

    this.cameras.main.setBounds(0, 0, w * TS, h * TS);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    this.keys = {
      cursors: this.input.keyboard!.createCursorKeys(),
      wasd: this.input.keyboard!.addKeys("W,A,S,D") as Record<string, Phaser.Input.Keyboard.Key>,
    };
    this.input.keyboard!.on("keydown-SPACE", () => void this.tryTalk());
    this.input.keyboard!.on("keydown-E", () => void this.tryTalk());
    this.input.on("pointerdown", () => void this.tryTalk());

    this.deps.onSceneChange(this.sceneIndex);
    void this.openScene();
  }

  private async openScene(): Promise<void> {
    if (!this.spec.open) return;
    this.busy = true;
    await this.deps.dialogue.say(this.spec.nameZh || this.spec.name, this.spec.open, "走吧 Set off");
    this.deps.dialogue.close();
    this.busy = false;
  }

  // ---- party --------------------------------------------------------------

  private donkeyCount(): number {
    return this.deps.counters["donkeys"] ?? 0;
  }

  private syncDonkeys(): void {
    const want = this.donkeyCount();
    const have = this.followers.filter((f) => f.sprite.texture.key === "donkey").length;
    for (let i = have; i < want; i++) {
      const lag = 28 + i * 15;
      const p = this.trail[Math.min(this.trail.length - 1, lag)];
      const s = this.add.image(p.x, p.y, "donkey").setOrigin(0.5, 1).setDepth(p.y);
      if (have > 0) {
        s.setAlpha(0);
        this.tweens.add({ targets: s, alpha: 1, duration: 520 });
      }
      this.followers.push({ sprite: s, lag });
    }
  }

  private refreshProps(): void {
    for (const p of this.propSprites) {
      const n = p.counter ? this.deps.counters[p.counter] ?? 0 : Infinity;
      p.sprite.setVisible(p.index < n);
    }
  }

  // ---- talking ------------------------------------------------------------

  private async tryTalk(): Promise<void> {
    if (this.busy || this.leaving || !this.near) return;
    const actor = this.actors.find((a) => a.spec === this.near);
    if (!actor || actor.done || !actor.spec.script?.length) return;

    this.busy = true;
    this.deps.setPrompt(null);
    this.liftCamera(actor.sprite.x, actor.sprite.y);
    const dlg = this.deps.dialogue;
    const script = actor.spec.script;

    try {
      if (actor.spec.intro) await dlg.say(actor.spec.name, actor.spec.intro, "開始 Begin");

      for (let i = 0; i < script.length; i++) {
        const q = this.enc.build(script[i]);
        this.deps.onQuestion(q, actor.spec.name);
        const res = await dlg.ask(actor.spec.name, q, `${i + 1} / ${script.length}`);
        this.deps.mastery.onAnswer(q.target, res.correct, res.usedHint);
        this.deps.refreshHud();
        this.deps.save();
      }

      this.applyOnDone(actor.spec);
      if (actor.spec.reward) await dlg.say(actor.spec.name, actor.spec.reward, "繼續 Keep walking");
    } finally {
      dlg.close();
      this.dropCamera();
      this.deps.onQuestion(null, "");
      actor.done = true;
      actor.bang?.destroy();
      this.deps.refreshHud();
      this.deps.save();
      this.busy = false;
    }
  }

  /** Centre between the player and whoever is talking, then raise the view. */
  private liftCamera(atX: number, atY: number): void {
    const cam = this.cameras.main;
    cam.stopFollow();
    cam.pan((this.player.x + atX) / 2, (this.player.y + atY) / 2 + TALK_CAM_LIFT, 380, "Sine.easeInOut");
  }

  private dropCamera(): void {
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
  }

  private applyOnDone(a: ActorSpec): void {
    const d = a.onDone;
    if (!d) return;

    if (d.unblock && a.blocksWall !== undefined) {
      for (const t of this.wallTiles.get(a.blocksWall) ?? []) this.solid.delete(t);
      for (const s of this.wallSprites.get(a.blocksWall) ?? []) {
        this.tweens.add({ targets: s, alpha: 0.14, duration: 700 });
      }
      for (let y = 1; y < this.spec.map.h - 1; y++) this.solid.delete(`${a.blocksWall},${y}`);
    }

    if (d.moveTo) {
      const actor = this.actors.find((x) => x.spec === a);
      if (actor) {
        const ty = this.resolveY(d.moveTo.y, d.moveTo.x);
        this.tweens.add({
          targets: actor.sprite,
          x: d.moveTo.x * TS + TS / 2,
          y: ty * TS + TS,
          duration: 950,
          ease: "Sine.easeInOut",
        });
      }
    }

    if (d.counters) {
      for (const [k, expr] of Object.entries(d.counters)) {
        const cur = this.deps.counters[k] ?? 0;
        this.deps.counters[k] = expr.startsWith("+")
          ? cur + Number(expr.slice(1))
          : expr.startsWith("-")
            ? cur - Number(expr.slice(1))
            : Number(expr);
      }
      this.syncDonkeys();
      this.refreshProps();
    }

    if (d.coins) this.deps.profile.coins += d.coins;

    if (d.party) {
      this.party.push(d.party);
      const lag = 20;
      const p = this.trail[Math.min(this.trail.length - 1, lag)];
      const s = this.add.image(p.x, p.y, "squirrel").setOrigin(0.5, 1).setDepth(p.y);
      this.followers.push({ sprite: s, lag });
    }
  }

  // ---- finale -------------------------------------------------------------

  private async runFinale(): Promise<void> {
    const f = this.spec.finaleScript;
    if (!f) return;
    this.busy = true;
    this.leaving = true;
    this.deps.setPrompt(null);
    this.liftCamera(this.player.x, this.player.y);
    const dlg = this.deps.dialogue;

    for (const line of f.lines) await dlg.say(f.name, line, "看一看 Look");

    const { tiles } = { tiles: f.choices };
    const q = {
      target: f.answer,
      en: f.prompt,
      parts: f.parts,
      tiles,
      count: tiles.length,
      strategy: "near" as const,
      picked: tiles.filter((c) => c !== f.answer),
      chosenBy: "fixed" as const,
      template: "finale",
      speakAnswer: false,
    };
    this.deps.onQuestion(q, f.name);
    const res = await dlg.ask("You", q);
    this.deps.onQuestion(null, "");
    this.deps.mastery.onAnswer(f.answer, res.correct, res.usedHint);
    if (res.correct) this.deps.profile.coins += f.coins;

    await dlg.say(f.name, f.after, "完成 Finish");
    dlg.close();

    this.deps.profile.completed = Array.from(
      new Set([...this.deps.profile.completed, this.deps.chapter.chapter])
    );
    this.deps.save();
    this.deps.onChapterComplete({
      party: ["小小", ...this.party],
      coins: this.deps.profile.coins,
      learned: this.deps.mastery.learned(),
      practised: this.deps.chapter.shengzi.filter((c) => this.deps.mastery.rec(c).seen > 0).length,
      total: this.deps.chapter.shengzi.length,
    });
  }

  // ---- frame --------------------------------------------------------------

  setPad(dir: "left" | "right" | "up" | "down", on: boolean): void {
    this.pad[dir] = on;
  }

  override update(time: number, delta: number): void {
    if (this.busy || this.leaving) {
      this.deps.setPrompt(null);
      return;
    }

    const { cursors, wasd } = this.keys;
    let vx = 0;
    let vy = 0;
    if (cursors.left.isDown || wasd.A.isDown || this.pad.left) vx -= 1;
    if (cursors.right.isDown || wasd.D.isDown || this.pad.right) vx += 1;
    if (cursors.up.isDown || wasd.W.isDown || this.pad.up) vy -= 1;
    if (cursors.down.isDown || wasd.S.isDown || this.pad.down) vy += 1;

    if (vx || vy) {
      const len = Math.hypot(vx, vy);
      const step = (SPEED * delta) / 1000 / len;
      const feetY = this.player.y - 5;
      const nx = this.player.x + vx * step;
      const ny = this.player.y + vy * step;
      if (!this.blocked(Math.floor(nx / TS), Math.floor(feetY / TS))) this.player.x = nx;
      if (!this.blocked(Math.floor(this.player.x / TS), Math.floor((ny - 5) / TS))) this.player.y = ny;
      if (vx < 0) this.player.setFlipX(true);
      else if (vx > 0) this.player.setFlipX(false);
      this.player.setDepth(this.player.y);
      this.player.setScale(1, 1 + Math.sin(time / 90) * 0.025);
      this.trail.unshift({ x: this.player.x, y: this.player.y });
      if (this.trail.length > 700) this.trail.pop();
    }

    for (const f of this.followers) {
      const p = this.trail[Math.min(this.trail.length - 1, f.lag)];
      f.sprite.setPosition(p.x, p.y).setDepth(p.y).setFlipX(this.player.flipX);
    }

    // proximity
    let found: ActorSpec | null = null;
    for (const a of this.actors) {
      if (a.done || !a.spec.script?.length) continue;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, a.sprite.x, a.sprite.y);
      if (d < TALK_RANGE) found = a.spec;
    }
    if (found !== this.near) {
      this.near = found;
      this.deps.setPrompt(found ? found.name : null);
    }

    // leaving the scene
    const gateOpen = this.actors.every((a) => a.spec.blocksWall === undefined || a.done);
    if (this.spec.exit && gateOpen && this.player.x > this.spec.exit.x * TS) {
      this.leaving = true;
      const next = this.deps.chapter.scenes.findIndex((s) => s.id === this.spec.exit!.to);
      this.deps.profile.sceneIndex = next;
      this.deps.save();
      this.cameras.main.fadeOut(320);
      this.cameras.main.once("camerafadeoutcomplete", () => {
        this.scene.restart({ deps: this.deps, index: next });
      });
    } else if (this.spec.finale && this.player.x > (this.spec.map.w - 4) * TS) {
      void this.runFinale();
    }
  }
}
