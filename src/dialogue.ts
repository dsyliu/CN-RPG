import { speakEn, speakZh, stopAudio } from "./audio";
import type { CharMap, Question } from "./types";

/**
 * The dialogue box. It sits at the BOTTOM of the game frame and deliberately does
 * not cover the world above it: when 老虎 asks how many donkeys you have, the answer
 * is the herd standing behind you on screen. Covering the world would turn the
 * question back into a flashcard.
 */

export interface DialogueHost {
  coins(): number;
  addCoins(n: number): void;
  phonetics(): "both" | "bpmf" | "pinyin";
}

export interface AnswerResult {
  correct: boolean;
  usedHint: boolean;
}

const SPEAKER_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/></svg>';

export class Dialogue {
  private el: HTMLDivElement | null = null;

  constructor(
    private root: HTMLElement,
    private chars: CharMap,
    private host: DialogueHost
  ) {}

  get isOpen(): boolean {
    return this.el !== null;
  }

  private open(): HTMLDivElement {
    if (!this.el) {
      this.el = document.createElement("div");
      this.el.className = "dlg";
      this.el.setAttribute("role", "dialog");
      this.root.appendChild(this.el);
    }
    return this.el;
  }

  close(): void {
    stopAudio();
    this.el?.remove();
    this.el = null;
  }

  /** A plain line of story with one button. Resolves when the button is pressed. */
  say(name: string, line: string, button = "繼續 Go on"): Promise<void> {
    const d = this.open();
    d.innerHTML = `
      <div class="speaker">
        <span class="name zh">${esc(name)}</span>
        <span class="grow"></span>
        <button class="speak" data-say aria-label="Say it again">${SPEAKER_ICON}</button>
      </div>
      <p class="line">${esc(line)}</p>
      <div class="row"><span class="grow"></span><button class="btn go" data-go>${esc(button)}</button></div>`;

    d.querySelector<HTMLButtonElement>("[data-say]")!.onclick = () => speakEn(line);
    speakEn(line);

    return new Promise((resolve) => {
      d.querySelector<HTMLButtonElement>("[data-go]")!.onclick = () => resolve();
    });
  }

  /** Ask one question. Resolves once the child has answered and moved on. */
  ask(name: string, q: Question, progress?: string): Promise<AnswerResult> {
    const d = this.open();
    d.innerHTML = `
      <div class="speaker">
        <span class="name zh">${esc(name)}</span>
        ${progress ? `<span class="chip">${esc(progress)}</span>` : ""}
        <span class="grow"></span>
        <button class="speak" data-say aria-label="Say it again">${SPEAKER_ICON}</button>
      </div>
      <p class="line">${esc(q.en)}</p>
      <div class="row">
        <div class="sentence zh" data-sentence></div>
        <span class="grow"></span>
        <div class="tiles zh" data-tiles></div>
      </div>
      <div class="row">
        <button class="btn hint" data-hint>注音 · 拼音<span class="cost">−1</span></button>
        <span class="verdict grow" data-verdict>Tap the character that belongs in the box.</span>
        <button class="btn go" data-go hidden>接下來 Next</button>
      </div>`;

    const sentence = d.querySelector<HTMLDivElement>("[data-sentence]")!;
    const tilesEl = d.querySelector<HTMLDivElement>("[data-tiles]")!;
    const hintBtn = d.querySelector<HTMLButtonElement>("[data-hint]")!;
    const verdict = d.querySelector<HTMLSpanElement>("[data-verdict]")!;
    const goBtn = d.querySelector<HTMLButtonElement>("[data-go]")!;

    sentence.innerHTML = q.parts
      .map((p) => (p === null ? `<span class="slot" data-slot></span>` : `<span class="tok">${esc(p)}</span>`))
      .join("");
    tilesEl.innerHTML = q.tiles
      .map((c) => `<button class="tile" data-c="${esc(c)}">${esc(c)}</button>`)
      .join("");

    const slot = sentence.querySelector<HTMLSpanElement>("[data-slot]")!;
    d.querySelector<HTMLButtonElement>("[data-say]")!.onclick = () => speakEn(q.en);

    speakEn(q.en);
    if (q.speakAnswer) window.setTimeout(() => speakZh(q.target), 1500);

    let usedHint = false;
    let answered = false;

    hintBtn.onclick = () => {
      if (answered || usedHint) return;
      if (this.host.coins() < 1) {
        verdict.textContent = "No coins for a hint — have a go anyway, nothing bad happens.";
        return;
      }
      usedHint = true;
      this.host.addCoins(-1);
      const info = this.chars[q.target];
      const mode = this.host.phonetics();
      const bits: string[] = [];
      if (mode !== "pinyin") bits.push(`<span class="bpmf">${esc(info.bpmf)}</span>`);
      if (mode !== "bpmf") bits.push(`<span class="py">${esc(info.pinyin)}</span>`);
      slot.insertAdjacentHTML("beforeend", `<span class="ruby">${bits.join("")}</span>`);
      hintBtn.disabled = true;
      verdict.innerHTML = `<b class="zh">${esc(info.bpmf)}</b> · <b>${esc(info.pinyin)}</b> — that is the sound. Which character is it?`;
      speakZh(q.target);
    };

    return new Promise<AnswerResult>((resolve) => {
      const finish = (correct: boolean) => {
        goBtn.hidden = true;
        resolve({ correct, usedHint });
      };

      tilesEl.querySelectorAll<HTMLButtonElement>(".tile").forEach((btn) => {
        btn.onclick = () => {
          if (answered) return;
          answered = true;
          const got = btn.dataset.c!;
          const want = q.target;
          const info = this.chars[want];

          tilesEl.querySelectorAll<HTMLButtonElement>(".tile").forEach((t) => {
            t.disabled = true;
            if (t !== btn) t.classList.add("dim");
          });
          slot.classList.add("filled");
          slot.insertAdjacentHTML("afterbegin", `<span class="drop">${esc(want)}</span>`);
          hintBtn.disabled = true;
          speakZh(want);

          if (got === want) {
            btn.classList.add("right");
            this.host.addCoins(usedHint ? 1 : 3);
            verdict.innerHTML = `對了！ <b class="zh">${esc(want)}</b> — <b>${esc(info.pinyin)}</b>, ${esc(info.en)}.`;
            window.setTimeout(() => finish(true), 1650);
          } else {
            // No failure state. A miss costs a coin and comes back later; it never
            // ends anything, and the right answer is always shown and spoken.
            btn.classList.add("wrong");
            const right = tilesEl.querySelector<HTMLButtonElement>(`.tile[data-c="${cssEsc(want)}"]`);
            right?.classList.remove("dim");
            right?.classList.add("right");
            this.host.addCoins(-1);
            verdict.innerHTML = `Not that one. This is <b class="zh">${esc(want)}</b> — <b>${esc(info.pinyin)}</b>, ${esc(info.en)}. You will see it again.`;
            goBtn.hidden = false;
            goBtn.onclick = () => finish(false);
          }
        };
      });
    });
  }
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );
}

function cssEsc(s: string): string {
  return typeof CSS !== "undefined" && CSS.escape ? CSS.escape(s) : s;
}
