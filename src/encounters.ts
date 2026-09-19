import { NUM, numOf } from "./content";
import type { Mastery } from "./mastery";
import type { CharMap, ChapterSpec, Question, Step, TemplateSpec } from "./types";

/**
 * Turns a chapter's script step into a question.
 *
 * Three kinds, and the difference is where the ANSWER comes from:
 *   world     - from something on screen. "How many donkeys?" is answered by
 *               looking at the herd behind you, not at a picture. This is the
 *               thing a flashcard app cannot do, so it is the preferred kind.
 *   scheduled - from the mastery model: lowest first, with review folded in.
 *   fixed     - written into the chapter file (十個十是一百).
 */

interface Vars {
  a: number;
  b: number;
}

type Filler = (target: string) => Vars | null;

const FILLERS: Record<string, Filler | undefined> = {
  // {a} here and {b} more -> a + b = target
  add: (target) => {
    const sum = numOf(target);
    if (sum === null || sum < 2) return null;
    const a = 1 + Math.floor(Math.random() * (sum - 1));
    return { a, b: sum - a };
  },
  // {a} were here, {b} left -> a - b = target
  sub: (target) => {
    const left = numOf(target);
    if (left === null || left < 1 || left > 9) return null;
    const b = 1 + Math.floor(Math.random() * Math.min(4, 10 - left));
    return { a: left + b, b };
  },
};

function fill(spec: TemplateSpec, vars: Vars | null): { en: string; parts: (string | null)[] } {
  if (!vars) return { en: spec.en, parts: spec.parts.slice() };
  const en = spec.en.replace(/\{a\}/g, String(vars.a)).replace(/\{b\}/g, String(vars.b));
  const parts = spec.parts.map((p) =>
    p === null ? null : p.replace(/\{A\}/g, NUM[vars.a] ?? "").replace(/\{B\}/g, NUM[vars.b] ?? "")
  );
  return { en, parts };
}

export class Encounters {
  constructor(
    private chapter: ChapterSpec,
    private chars: CharMap,
    private mastery: Mastery,
    private counters: Record<string, number>
  ) {}

  /** Which characters a template is able to ask about at all. */
  private eligible(id: string, spec: TemplateSpec): string[] {
    const pool = this.chapter.shengzi.filter((c) => this.chars[c]);
    if (!spec.range) return pool;
    const [lo, hi] = spec.range;
    return pool.filter((c) => {
      const n = numOf(c);
      if (n === null || n < lo || n > hi) return false;
      const f = FILLERS[id];
      return f ? f(c) !== null : true;
    });
  }

  build(step: Step): Question {
    if (step.kind === "world") {
      const n = this.counters[step.counter] ?? 0;
      const target = NUM[n];
      if (!target) {
        // A counter outside 1-10 cannot be asked as a numeral; fall back rather
        // than show an empty slot.
        return this.build({ kind: "scheduled", template: "listen" });
      }
      return this.finish(target, step.en, step.parts, "world", "world:" + step.counter, false);
    }

    if (step.kind === "fixed") {
      return this.finish(step.answer, step.en, step.parts, "fixed", "fixed", false);
    }

    const spec = this.chapter.templates[step.template];
    if (!spec) throw new Error(`chapter ${this.chapter.chapter}: unknown template "${step.template}"`);

    const pool = this.eligible(step.template, spec);
    const target = this.mastery.pick(pool.length ? pool : undefined);

    const filler = FILLERS[step.template];
    const vars = filler ? filler(target) : null;
    if (filler && !vars) {
      // The scheduler picked something this template cannot express (百 for "add").
      // Ask it as a listening question instead of forcing a bad fit.
      const listen = this.chapter.templates["listen"];
      if (listen) {
        return this.finish(target, listen.en, listen.parts, "scheduler", "listen", !!listen.speakAnswer);
      }
    }
    const { en, parts } = fill(spec, vars);
    return this.finish(target, en, parts, "scheduler", step.template, !!spec.speakAnswer);
  }

  private finish(
    target: string,
    en: string,
    parts: (string | null)[],
    chosenBy: Question["chosenBy"],
    template: string,
    speakAnswer: boolean
  ): Question {
    const { tiles, count, strategy, picked } = this.mastery.choices(target);
    this.mastery.onShown(target);
    return { target, en, parts, tiles, count, strategy, picked, chosenBy, template, speakAnswer };
  }
}
