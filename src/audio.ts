/**
 * Audio is manifest-first: pre-generated zh-TW files if they are present, browser
 * speech synthesis only as a fallback.
 *
 * DESIGN.md rejects runtime TTS for production because voice availability is
 * per-device and the failure mode is a button that silently does nothing. That is
 * exactly why audioMode() is public: the UI shows which one is in use, so a missing
 * voice is visible rather than silent. Run `npm run audio` to generate the files.
 */

interface Manifest {
  voice: string;
  clips: Record<string, string>;
}

const base = import.meta.env.BASE_URL || "./";

let manifest: Manifest | null = null;
let zhVoice: SpeechSynthesisVoice | null = null;
let enVoice: SpeechSynthesisVoice | null = null;
const cache = new Map<string, HTMLAudioElement>();
let current: HTMLAudioElement | null = null;

export type AudioMode = "files" | "speech" | "silent";

export function audioMode(): AudioMode {
  if (manifest && Object.keys(manifest.clips).length) return "files";
  if (zhVoice) return "speech";
  return "silent";
}

export function audioLabel(): string {
  switch (audioMode()) {
    case "files":
      return `audio: ${manifest?.voice ?? "zh-TW"} files`;
    case "speech":
      return `audio: ${zhVoice?.lang ?? "zh"} (browser voice — stand-in)`;
    default:
      return "no Mandarin voice on this device";
  }
}

function pickVoices(): void {
  if (!("speechSynthesis" in window)) return;
  const vs = speechSynthesis.getVoices();
  if (!vs.length) return;
  zhVoice =
    vs.find((v) => v.lang === "zh-TW") ??
    vs.find((v) => /^zh[-_](Hant|HK)/i.test(v.lang)) ??
    vs.find((v) => /^zh/i.test(v.lang)) ??
    null;
  enVoice = vs.find((v) => /^en[-_]US/i.test(v.lang)) ?? vs.find((v) => /^en/i.test(v.lang)) ?? null;
}

export async function initAudio(): Promise<void> {
  if ("speechSynthesis" in window) {
    pickVoices();
    speechSynthesis.onvoiceschanged = pickVoices;
    window.setTimeout(pickVoices, 700);
  }
  try {
    const res = await fetch(base + "audio/manifest.json", { cache: "no-cache" });
    if (res.ok) manifest = (await res.json()) as Manifest;
  } catch {
    // No generated audio yet — speech synthesis carries it, and the HUD says so.
  }
}

function playFile(file: string): boolean {
  try {
    let el = cache.get(file);
    if (!el) {
      el = new Audio(base + "audio/" + file);
      el.preload = "auto";
      cache.set(file, el);
    }
    if (current && current !== el) {
      current.pause();
      current.currentTime = 0;
    }
    el.currentTime = 0;
    void el.play().catch(() => undefined);
    current = el;
    return true;
  } catch {
    return false;
  }
}

function synth(text: string, lang: "zh" | "en"): void {
  if (!("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  if (lang === "zh") {
    if (zhVoice) u.voice = zhVoice;
    u.lang = zhVoice?.lang ?? "zh-TW";
    u.rate = 0.78;
  } else {
    if (enVoice) u.voice = enVoice;
    u.lang = enVoice?.lang ?? "en-US";
    u.rate = 0.93;
  }
  try {
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}

export function speakZh(text: string): void {
  const file = manifest?.clips["zh:" + text];
  if (file && playFile(file)) return;
  synth(text, "zh");
}

/**
 * Names are written in Chinese in the story copy but read aloud by an English
 * voice, which cannot pronounce them. Romanize before speaking.
 */
const ROMAN: Record<string, string> = {
  小小: "Shau Shau",
  中中: "Jong Jong",
  明明: "Ming Ming",
  小石: "Shau Shr",
  友友: "You You",
  老虎: "the tiger",
  松鼠: "the squirrels",
  小松鼠: "the little squirrel",
  果園: "the orchard keeper",
  驢: "donkeys",
};

export function toSpoken(text: string): string {
  let out = text;
  for (const [zh, en] of Object.entries(ROMAN)) out = out.split(zh).join(en);
  // Any Chinese left in an English line is a counter or a 生字 being shown, not spoken.
  return out.replace(/[一-鿿]+/g, "").replace(/\s{2,}/g, " ").trim();
}

export function speakEn(text: string): void {
  const file = manifest?.clips["en:" + text];
  if (file && playFile(file)) return;
  synth(toSpoken(text), "en");
}

export function stopAudio(): void {
  try {
    if (current) current.pause();
    if ("speechSynthesis" in window) speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}
