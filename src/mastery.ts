import type { CharMap, Question } from "./types";

export interface Rec {
  mastery: number;   // 0..5
  seen: number;
  correct: number;
  hinted: boolean;   // this character has at some point been answered with a hint
}

export interface MasteryState {
  recs: Record<string, Rec>;
  reQueue: { ch: string; wait: number }[];
  sinceReview: number;
  lastShown: string | null;
}

export function emptyState(pool: string[]): MasteryState {
  const recs: Record<string, Rec> = {};
  for (const c of pool) recs[c] = { mastery: 0, seen: 0, correct: 0, hinted: false };
  return { recs, reQueue: [], sinceReview: 0, lastShown: null };
}

const MAX = 5;

export class Mastery {
  constructor(
    public state: MasteryState,
    private pool: string[],
    private chars: CharMap
  ) {
    // A pool can grow between sessions (a new chapter); never lose old records.
    for (const c of pool) {
      if (!this.state.recs[c]) this.state.recs[c] = { mastery: 0, seen: 0, correct: 0, hinted: false };
    }
  }

  rec(ch: string): Rec {
    return (this.state.recs[ch] ??= { mastery: 0, seen: 0, correct: 0, hinted: false });
  }

  /**
   * Lowest mastery first, but every fourth question pulls back something already
   * known. That is the whole of "review is woven in": there is no review screen,
   * and the child cannot tell a review question from a new one.
   */
  pick(eligible?: string[]): string {
    const s = this.state;
    const usable = (eligible?.length ? eligible : this.pool).filter((c) => c !== s.lastShown);
    const pool = usable.length ? usable : (eligible?.length ? eligible : this.pool);

    const due = s.reQueue.findIndex((r) => r.wait <= 0 && pool.includes(r.ch));
    if (due >= 0) return s.reQueue.splice(due, 1)[0].ch;
    for (const r of s.reQueue) r.wait--;

    s.sinceReview++;
    if (s.sinceReview >= 4) {
      const known = pool.filter((c) => this.rec(c).mastery >= 3);
      if (known.length) {
        s.sinceReview = 0;
        return known[(Math.random() * known.length) | 0];
      }
    }

    let low = Infinity;
    for (const c of pool) low = Math.min(low, this.rec(c).mastery);
    const tied = pool.filter((c) => this.rec(c).mastery === low);
    return tied[(Math.random() * tied.length) | 0];
  }

  /**
   * Difficulty adapts here and nowhere else. The child never sees a setting, and
   * there is no label anywhere in the game for what tier they are in.
   */
  choices(target: string): Pick<Question, "tiles" | "count" | "strategy" | "picked"> {
    const m = this.rec(target).mastery;
    const count = m < 2 ? 2 : m < 4 ? 3 : 4;
    const strategy: Question["strategy"] = m < 2 ? "far" : m < 4 ? "mixed" : "near";

    const near = (this.chars[target]?.near ?? []).filter((c) => this.pool.includes(c));
    const far = this.pool.filter((c) => c !== target && !near.includes(c));

    let order: string[];
    if (strategy === "far") order = shuffle(far.slice());
    else if (strategy === "near") order = shuffle(near.slice()).concat(shuffle(far.slice()));
    else order = shuffle(near.slice()).slice(0, 1).concat(shuffle(far.slice()));

    const picked: string[] = [];
    for (const c of order) {
      if (picked.length >= count - 1) break;
      if (!picked.includes(c)) picked.push(c);
    }
    return { tiles: shuffle(picked.concat([target])), count, strategy, picked };
  }

  onShown(ch: string): void {
    this.rec(ch).seen++;
    this.state.lastShown = ch;
  }

  /** There is no failure state: a miss costs progress, never survival. */
  onAnswer(ch: string, correct: boolean, usedHint: boolean): void {
    const r = this.rec(ch);
    if (correct) {
      r.correct++;
      if (usedHint) r.hinted = true;
      else r.mastery = Math.min(MAX, r.mastery + 1);
    } else {
      r.mastery = Math.max(0, r.mastery - 1);
      this.state.reQueue.push({ ch, wait: 2 });
    }
  }

  learned(): number {
    return this.pool.filter((c) => this.rec(c).mastery >= 4).length;
  }
}

export function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
