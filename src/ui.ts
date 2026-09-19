import { audioLabel } from "./audio";
import type { Mastery } from "./mastery";
import {
  createProfile,
  exportCode,
  importCode,
  listProfiles,
  setLast,
  type Profile,
} from "./profile";
import type { ChapterSpec, CharMap, Question } from "./types";
import type { ChapterSummary } from "./world";

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

/* ------------------------------------------------------------------ HUD --- */

export class Hud {
  private lastCoins = -1;

  constructor(
    private profile: Profile,
    private chapter: ChapterSpec,
    private counters: Record<string, number>
  ) {
    $("chapter-title").textContent = `${chapter.title} · ${chapter.titleEn}`;
    $("chip-chapter").textContent = `Ch ${chapter.chapter} · 單元 ${chapter.unit} · ${chapter.virtue.zh}`;
    $("chip-lessons").textContent = `生字 L${chapter.lessons.join("+L")}`;
    $("btn-profile").hidden = false;
    this.refresh();
  }

  setAudioLabel(): void {
    const chip = $("chip-audio");
    chip.textContent = audioLabel();
    chip.classList.toggle("warn", audioLabel().startsWith("no "));
  }

  setScene(index: number): void {
    const s = this.chapter.scenes[index];
    $("hud-scene").textContent = `${index + 1}/${this.chapter.scenes.length} · ${s.name}`;
  }

  refresh(): void {
    const who = $("hud-who");
    who.innerHTML = this.profile.nameZh
      ? `${escapeHtml(this.profile.nameEn)} <small>· <span class="zh">${escapeHtml(this.profile.nameZh)}</span></small>`
      : escapeHtml(this.profile.nameEn);

    const donkeys = this.counters["donkeys"];
    const dEl = $("hud-donkeys");
    if (donkeys === undefined) {
      dEl.hidden = true;
    } else {
      dEl.hidden = false;
      dEl.innerHTML = `驢 <b>${donkeys}</b> / 10`;
    }

    const coinsEl = $("hud-coins");
    coinsEl.innerHTML = `<span class="dot"></span><b>${this.profile.coins}</b>`;
    if (this.lastCoins >= 0 && this.profile.coins !== this.lastCoins) {
      coinsEl.classList.remove("bump");
      void coinsEl.offsetWidth;
      coinsEl.classList.add("bump");
    }
    this.lastCoins = this.profile.coins;
  }
}

/* --------------------------------------------------------------- prompt --- */

export function setPrompt(stage: HTMLElement, name: string | null): void {
  stage.querySelector(".talk")?.remove();
  if (!name) return;
  const el = document.createElement("div");
  el.className = "talk";
  el.innerHTML = `<kbd>SPACE</kbd> talk to <span class="zh">${escapeHtml(name)}</span>`;
  stage.appendChild(el);
}

/* --------------------------------------------------------- engine panel --- */

export class EnginePanel {
  private current: Question | null = null;
  private speaker = "";

  constructor(
    private mastery: Mastery,
    private chars: CharMap,
    private chapter: ChapterSpec,
    private counters: Record<string, number>,
    private profile: Profile
  ) {
    $("panel-count").textContent = String(chapter.shengzi.length);
  }

  note(q: Question | null, speaker = ""): void {
    this.current = q;
    this.speaker = speaker;
    this.render();
  }

  render(): void {
    const s = this.mastery.state;
    const q = this.current;
    const kv: string[] = [];

    if (q) {
      const rec = this.mastery.rec(q.target);
      const info = this.chars[q.target];
      const cls = q.chosenBy === "world" ? "c-world" : q.chosenBy === "scheduler" ? "c-far" : "";
      kv.push(
        row("asked by", `<span class="zh">${escapeHtml(this.speaker || "—")}</span>`),
        row("target", `<span class="zh">${escapeHtml(q.target)}</span> &nbsp;${escapeHtml(info.pinyin)} · ${escapeHtml(info.en)}`),
        row("chosen by", `<span class="${cls}">${q.chosenBy}</span>`),
        row("template", escapeHtml(q.template)),
        row("mastery", `${rec.mastery} / 5${rec.hinted ? " · hint-assisted" : ""}`),
        row("choices", String(q.count)),
        row(
          "distractors",
          `<span class="${q.strategy === "near" ? "c-near" : q.strategy === "far" ? "c-far" : ""}">${q.strategy}</span> — <span class="zh">${escapeHtml(q.picked.join(" "))}</span>`
        )
      );
    } else {
      kv.push(row("state", "walking — no question open"));
    }

    kv.push(
      row("counters", Object.entries(this.counters).map(([k, v]) => `${k}=${v}`).join(" ")),
      row("re-queued", s.reQueue.length ? s.reQueue.map((r) => `${r.ch}(${r.wait})`).join(" ") : "—"),
      row("to review", String(Math.max(0, 4 - s.sinceReview))),
      row("mastered", `${this.mastery.learned()} / ${this.chapter.shengzi.length}`),
      row("coins", String(this.profile.coins))
    );
    $("panel-state").innerHTML = kv.join("");

    $("panel-table").innerHTML = this.chapter.shengzi
      .map((c) => {
        const r = this.mastery.rec(c);
        const info = this.chars[c];
        const bars = Array.from({ length: 5 }, (_, i) => {
          const on = i < r.mastery;
          const gold = on && r.hinted && i === r.mastery - 1;
          return `<i class="${gold ? "hint" : on ? "on" : ""}"></i>`;
        }).join("");
        return `<tr class="${q && c === q.target ? "active" : ""}">
          <td class="c">${escapeHtml(c)}</td>
          <td class="z">${escapeHtml(info.bpmf)}</td>
          <td>${escapeHtml(info.pinyin)}</td>
          <td class="z">${escapeHtml(info.radical)}</td>
          <td><span class="bars">${bars}</span></td>
          <td>${r.seen}</td></tr>`;
      })
      .join("");
  }
}

function row(k: string, v: string): string {
  return `<dt>${escapeHtml(k)}</dt><dd>${v}</dd>`;
}

/* --------------------------------------------------------------- modals --- */

function modal(html: string): { root: HTMLDivElement; close: () => void } {
  const root = document.createElement("div");
  root.className = "modal";
  root.innerHTML = `<div class="card">${html}</div>`;
  $("modal-root").appendChild(root);
  return { root, close: () => root.remove() };
}

/**
 * Who is playing. Multi-profile from the first run, because retrofitting it onto a
 * single save is miserable and one laptop is shared by siblings.
 */
export function chooseProfile(pool: string[]): Promise<Profile> {
  return new Promise((resolve) => {
    const existing = listProfiles();

    const render = () => {
      const list = listProfiles();
      const m = modal(`
        <h3>Who is playing?</h3>
        <p>Progress is kept on this device only. Nothing is sent anywhere.</p>
        <div class="who-list" data-list>
          ${list
            .map(
              (p) => `<button data-pick="${p.id}">
                <span>${escapeHtml(p.nameEn)}${p.nameZh ? ` <span class="zh">· ${escapeHtml(p.nameZh)}</span>` : ""}</span>
                <span class="meta">${p.completed.length} ch · ${p.coins} coins</span>
              </button>`
            )
            .join("")}
        </div>
        <div class="row">
          <button class="btn go" data-new>New player</button>
          <button class="btn" data-import>Restore from a code</button>
        </div>`);

      m.root.querySelectorAll<HTMLButtonElement>("[data-pick]").forEach((b) => {
        b.onclick = () => {
          const p = list.find((x) => x.id === b.dataset.pick)!;
          setLast(p.id);
          m.close();
          resolve(p);
        };
      });
      m.root.querySelector<HTMLButtonElement>("[data-new]")!.onclick = () => {
        m.close();
        newPlayer(pool).then(resolve);
      };
      m.root.querySelector<HTMLButtonElement>("[data-import]")!.onclick = () => {
        m.close();
        restore(pool).then(resolve);
      };
    };

    if (!existing.length) newPlayer(pool).then(resolve);
    else render();
  });
}

/** 姓名 is picked from a grid, never typed: a 6-year-old cannot type 漢字. */
const SURNAMES = "王李張陳林黃吳劉蔡楊許鄭謝郭洪曾廖賴徐周葉蘇莊呂江何蕭羅高".split("");
const GIVEN = "明美華安平心宜玟家豪偉婷雅軒欣凱宏文君志建淑慧俊瑜哲芳".split("");

function newPlayer(pool: string[]): Promise<Profile> {
  return new Promise((resolve) => {
    let avatar = 0;
    let surname = "";
    const given: string[] = [];

    const m = modal(`
      <h3>What is your name?</h3>
      <label for="np-en">Your name</label>
      <input id="np-en" type="text" autocomplete="off" spellcheck="false" placeholder="Emma" maxlength="24" />

      <label>Pick your character</label>
      <div class="avatars" data-av>
        ${[0, 1, 2, 3].map((i) => `<button data-i="${i}" aria-pressed="${i === 0}">${"①②③④"[i]}</button>`).join("")}
      </div>

      <label>Your Chinese name — ask a grown-up (you can skip this)</label>
      <div class="zhname" data-zh>&nbsp;</div>
      <div class="zhgrid" data-surname>${SURNAMES.slice(0, 14).map((c) => `<button data-s="${c}">${c}</button>`).join("")}</div>
      <div class="zhgrid" data-given style="margin-top:6px">${GIVEN.slice(0, 14).map((c) => `<button data-g="${c}">${c}</button>`).join("")}</div>

      <div class="row">
        <button class="btn" data-clear>Clear</button>
        <span class="grow"></span>
        <button class="btn go" data-start>開始 Start</button>
      </div>`);

    const zhOut = m.root.querySelector<HTMLDivElement>("[data-zh]")!;
    const paint = () => {
      const full = surname + given.join("");
      zhOut.textContent = full || " ";
    };

    m.root.querySelectorAll<HTMLButtonElement>("[data-av] button").forEach((b) => {
      b.onclick = () => {
        avatar = Number(b.dataset.i);
        m.root.querySelectorAll<HTMLButtonElement>("[data-av] button").forEach((x) =>
          x.setAttribute("aria-pressed", String(x === b))
        );
      };
    });
    m.root.querySelectorAll<HTMLButtonElement>("[data-surname] button").forEach((b) => {
      b.onclick = () => {
        surname = b.dataset.s!;
        m.root.querySelectorAll<HTMLButtonElement>("[data-surname] button").forEach((x) =>
          x.setAttribute("aria-pressed", String(x === b))
        );
        paint();
      };
    });
    m.root.querySelectorAll<HTMLButtonElement>("[data-given] button").forEach((b) => {
      b.onclick = () => {
        if (given.length >= 2) given.shift();
        given.push(b.dataset.g!);
        paint();
      };
    });
    m.root.querySelector<HTMLButtonElement>("[data-clear]")!.onclick = () => {
      surname = "";
      given.length = 0;
      m.root.querySelectorAll<HTMLButtonElement>("[data-surname] button").forEach((x) =>
        x.setAttribute("aria-pressed", "false")
      );
      paint();
    };

    const input = m.root.querySelector<HTMLInputElement>("#np-en")!;
    input.focus();
    const start = () => {
      const p = createProfile(input.value, surname + given.join(""), avatar, pool);
      m.close();
      resolve(p);
    };
    m.root.querySelector<HTMLButtonElement>("[data-start]")!.onclick = start;
    input.onkeydown = (e) => {
      if (e.key === "Enter") start();
    };
  });
}

function restore(pool: string[]): Promise<Profile> {
  return new Promise((resolve) => {
    const m = modal(`
      <h3>Restore a save code</h3>
      <p>Paste the code from another device.</p>
      <label for="rc">Save code</label>
      <input id="rc" type="text" autocomplete="off" spellcheck="false" />
      <p data-msg></p>
      <div class="row"><span class="grow"></span><button class="btn go" data-ok>Restore</button></div>`);
    const input = m.root.querySelector<HTMLInputElement>("#rc")!;
    input.focus();
    m.root.querySelector<HTMLButtonElement>("[data-ok]")!.onclick = () => {
      const p = importCode(input.value);
      if (!p) {
        m.root.querySelector<HTMLParagraphElement>("[data-msg]")!.textContent =
          "That code could not be read. Check it was copied whole.";
        return;
      }
      setLast(p.id);
      m.close();
      resolve(p);
    };
    m.root.querySelector<HTMLDivElement>(".card")!.insertAdjacentHTML(
      "beforeend",
      `<div class="row"><button class="btn" data-back>Back</button></div>`
    );
    m.root.querySelector<HTMLButtonElement>("[data-back]")!.onclick = () => {
      m.close();
      chooseProfile(pool).then(resolve);
    };
  });
}

export function chapterCard(chapter: ChapterSpec, summary: ChapterSummary, profile: Profile): void {
  const m = modal(`
    <div class="center">
      <div class="virtue">${escapeHtml(chapter.virtue.zh)}</div>
      <h3>Chapter ${chapter.chapter} complete</h3>
      <p><b>${escapeHtml(chapter.title)}</b> — ${escapeHtml(chapter.virtue.en)}</p>
      <div class="party">
        ${summary.party.map((p) => `<span>${escapeHtml(p)} joined</span>`).join("")}
        <span>驢 × 十</span>
      </div>
      <p style="margin-top:12px">
        ${summary.practised} of ${summary.total} 生字 practised${
          summary.learned ? ` · ${summary.learned} mastered` : ""
        } · ${summary.coins} coins
      </p>
      <p style="font-size:12.5px">Come back and they will stick. Mastery needs four goes without a hint.</p>
      <div class="row" style="justify-content:center">
        <button class="btn" data-code>Show save code</button>
        <button class="btn go" data-again>再玩一次 Play again</button>
      </div>
      <div class="savecode" data-out hidden></div>
    </div>`);
  m.root.querySelector<HTMLButtonElement>("[data-again]")!.onclick = () => location.reload();
  m.root.querySelector<HTMLButtonElement>("[data-code]")!.onclick = () => {
    const out = m.root.querySelector<HTMLDivElement>("[data-out]")!;
    out.hidden = false;
    out.textContent = exportCode(profile);
  };
}

export function fatal(message: string): void {
  const stage = $("stage");
  stage.innerHTML = `<div class="err">${escapeHtml(message)}</div>`;
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );
}
