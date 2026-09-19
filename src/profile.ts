import { emptyState, type MasteryState } from "./mastery";

/**
 * Progress lives in localStorage on this device and goes nowhere else: no server,
 * no account, nothing about a child ever transmitted. Multi-profile from the start,
 * because one laptop is shared by siblings and one classroom tablet by a whole class.
 *
 * The export/import code is the recovery path when a device is wiped.
 */

const KEY = "cnrpg.profiles.v1";
const LAST = "cnrpg.lastProfile";

export interface Profile {
  id: string;
  nameEn: string;
  nameZh: string;     // may be empty -- 我叫 Emma is a real answer, not a fallback
  avatar: number;
  coins: number;
  createdAt: number;
  chapter: number;
  sceneIndex: number;
  completed: number[];
  phonetics: "both" | "bpmf" | "pinyin";
  mastery: MasteryState;
  /** World counters (donkeys, squirrels …) are progress too: resuming in the
   *  orchard must not hand back the five donkeys the keeper has not returned. */
  counters?: Record<string, number>;
}

interface Store {
  version: 1;
  profiles: Profile[];
}

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Store;
      if (parsed && Array.isArray(parsed.profiles)) return parsed;
    }
  } catch {
    // A blocked or full localStorage must not stop a child from playing.
  }
  return { version: 1, profiles: [] };
}

function write(store: Store): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* ignore: play continues, progress just will not survive a reload */
  }
}

export function listProfiles(): Profile[] {
  return read().profiles.sort((a, b) => b.createdAt - a.createdAt);
}

export function createProfile(
  nameEn: string,
  nameZh: string,
  avatar: number,
  pool: string[]
): Profile {
  const p: Profile = {
    id: `p${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`,
    nameEn: nameEn.trim().slice(0, 24) || "Friend",
    nameZh: nameZh.trim().slice(0, 4),
    avatar,
    coins: 12,
    createdAt: Date.now(),
    chapter: 1,
    sceneIndex: 0,
    completed: [],
    phonetics: "both",
    mastery: emptyState(pool),
  };
  const store = read();
  store.profiles.push(p);
  write(store);
  setLast(p.id);
  return p;
}

export function saveProfile(p: Profile): void {
  const store = read();
  const i = store.profiles.findIndex((x) => x.id === p.id);
  if (i >= 0) store.profiles[i] = p;
  else store.profiles.push(p);
  write(store);
}

export function deleteProfile(id: string): void {
  const store = read();
  store.profiles = store.profiles.filter((p) => p.id !== id);
  write(store);
}

export function setLast(id: string): void {
  try {
    localStorage.setItem(LAST, id);
  } catch {
    /* ignore */
  }
}

export function getLast(): string | null {
  try {
    return localStorage.getItem(LAST);
  } catch {
    return null;
  }
}

/** A save code a parent can write down. Base64 of the profile, no personal data leaves the device. */
export function exportCode(p: Profile): string {
  const json = JSON.stringify(p);
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/=+$/, "");
}

export function importCode(code: string): Profile | null {
  try {
    const bin = atob(code.trim());
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const p = JSON.parse(new TextDecoder().decode(bytes)) as Profile;
    if (!p?.id || typeof p.nameEn !== "string" || !p.mastery?.recs) return null;
    p.id = `${p.id}-i${Math.floor(Math.random() * 1e3).toString(36)}`;
    saveProfile(p);
    return p;
  } catch {
    return null;
  }
}
