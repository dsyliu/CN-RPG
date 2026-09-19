/** Shapes of the files under content/. Nothing here is engine state. */

export interface CharInfo {
  pinyin: string;
  bpmf: string;
  en: string;
  radical: string;
  lesson: number;
  unit: number;
  pictograph: boolean;
  near: string[];
}
export type CharMap = Record<string, CharInfo>;

export interface CharactersFile {
  count: number;
  characters: CharMap;
}

export interface LessonInfo {
  lesson: number;
  unit: number;
  shengzi: string[];
  shengzi_guide: string[];
  changyong: string[];
  buchong: string[];
  patterns: string;
}

export interface UnitInfo {
  unit: number;
  lessons: number[];
  story: string;
  virtue: string;
}

export interface LessonsFile {
  book: number;
  units: UnitInfo[];
  lessons: LessonInfo[];
}

/**
 * A y-coordinate in a chapter file. Either an absolute tile row, or relative to
 * the path at that column: "path", "path-3", "path+2". Authors rarely know the
 * absolute row, because the path is a curve.
 */
export type YExpr = number | string;

export interface PathSpec {
  base: number;
  amp: number;
  period: number;
  width: number;
}

export interface WallSpec {
  x: number;
  kind: string;
}

export interface FeatureSpec {
  kind: string;
  x: number;
  y: YExpr;
}

export interface MapSpec {
  w: number;
  h: number;
  path: PathSpec;
  treeXs: number[];
  walls: WallSpec[];
  features: FeatureSpec[];
}

export interface TemplateSpec {
  en: string;
  parts: (string | null)[];
  range?: [number, number];
  speakAnswer?: boolean;
}

export type Step =
  | { kind: "world"; counter: string; en: string; parts: (string | null)[] }
  | { kind: "scheduled"; template: string }
  | { kind: "fixed"; answer: string; en: string; parts: (string | null)[] };

export interface OnDone {
  unblock?: boolean;
  moveTo?: { x: number; y: YExpr };
  party?: string;
  coins?: number;
  counters?: Record<string, string>;
}

export interface ActorSpec {
  id: string;
  sprite: string;
  name: string;
  nameEn: string;
  x: number;
  y: YExpr;
  follows?: boolean;
  blocksWall?: number;
  intro?: string;
  reward?: string;
  script?: Step[];
  onDone?: OnDone;
}

export interface PropSpec {
  sprite: string;
  counter?: string;
  at: [number, YExpr][];
}

export interface FinaleSpec {
  name: string;
  lines: string[];
  prompt: string;
  answer: string;
  choices: string[];
  parts: (string | null)[];
  after: string;
  coins: number;
}

export interface SceneSpec {
  id: string;
  name: string;
  nameZh: string;
  lesson: number;
  open: string;
  map: MapSpec;
  spawn: { x: number; y: YExpr };
  exit?: { x: number; to: string };
  actors: ActorSpec[];
  props: PropSpec[];
  finale?: boolean;
  finaleScript?: FinaleSpec;
}

export interface ChapterSpec {
  chapter: number;
  unit: number;
  lessons: number[];
  title: string;
  titleEn: string;
  virtue: { zh: string; en: string };
  shengzi: string[];
  counters: Record<string, number>;
  templates: Record<string, TemplateSpec>;
  scenes: SceneSpec[];
}

/** A question, once built and ready to show. */
export interface Question {
  target: string;
  en: string;
  parts: (string | null)[];
  tiles: string[];
  count: number;
  strategy: "far" | "mixed" | "near";
  picked: string[];
  chosenBy: "world" | "scheduler" | "fixed";
  template: string;
  speakAnswer: boolean;
}
