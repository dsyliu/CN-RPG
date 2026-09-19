import type { CharactersFile, CharMap, ChapterSpec, LessonsFile } from "./types";

/**
 * Content is fetched, not bundled: vite.config.ts serves content/ as the static
 * root, so editing a chapter file and reloading is enough. No rebuild, no code.
 */

const base = import.meta.env.BASE_URL || "./";

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(base + path, { cache: "no-cache" });
  if (!res.ok) throw new Error(`content: ${path} -> ${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

export interface Content {
  chars: CharMap;
  lessons: LessonsFile;
  chapter: ChapterSpec;
}

export async function loadContent(chapterNo: number): Promise<Content> {
  const id = String(chapterNo).padStart(2, "0");
  const [charsFile, lessons, chapter] = await Promise.all([
    getJSON<CharactersFile>("characters.json"),
    getJSON<LessonsFile>("lessons.json"),
    getJSON<ChapterSpec>(`chapters/ch${id}.json`),
  ]);

  const chars = charsFile.characters;

  // Fail loudly here rather than mysteriously three scenes later.
  const missing = chapter.shengzi.filter((c) => !chars[c]);
  if (missing.length) {
    throw new Error(
      `chapter ${chapterNo} lists 生字 that characters.json does not have: ${missing.join(" ")}`
    );
  }

  return { chars, lessons, chapter };
}

/** Numerals 1-10, for the counting questions. */
export const NUM: Record<number, string> = {
  1: "一", 2: "二", 3: "三", 4: "四", 5: "五",
  6: "六", 7: "七", 8: "八", 9: "九", 10: "十",
};

export function numOf(ch: string): number | null {
  const hit = Object.entries(NUM).find(([, v]) => v === ch);
  return hit ? Number(hit[0]) : null;
}
