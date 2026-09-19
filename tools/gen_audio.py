#!/usr/bin/env python3
"""
Pre-generate the audio the game plays, and write content/audio/manifest.json.

Why files rather than the browser's own speech synthesis: voice availability is
per-device, and when a Mandarin voice is missing the failure mode is a button that
silently does nothing. Files work identically everywhere, including offline.
See DESIGN.md 4.3.

    pip install edge-tts
    python tools/gen_audio.py            # everything that is missing
    python tools/gen_audio.py --force    # regenerate all

zh-TW on purpose: 美洲華語 is a Taiwan-lineage curriculum, and a mainland voice
reading it sounds wrong to exactly the heritage parents most likely to judge this.

Every clip is keyed by the text itself, so a teacher's real recording can replace
any file later without touching the game:
    content/audio/zh/<hash>.mp3  <-  manifest["zh:虎"]
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "content"
OUT = CONTENT / "audio"

ZH_VOICE = "zh-TW-HsiaoChenNeural"
EN_VOICE = "en-US-AnaNeural"      # a child voice; en-US-JennyNeural is the adult option
ZH_RATE = "-20%"
EN_RATE = "-8%"

CJK = re.compile(r"[一-鿿]")

# English story lines mention the cast in Chinese; an English voice cannot read
# those. Mirrors ROMAN in src/audio.ts -- keep the two in step.
ROMAN = {
    "小小": "Shau Shau", "中中": "Jong Jong", "明明": "Ming Ming",
    "小石": "Shau Shr", "友友": "You You", "老虎": "the tiger",
    "松鼠": "the squirrels", "小松鼠": "the little squirrel",
    "果園": "the orchard keeper", "驢": "donkeys",
}


def spoken(text: str) -> str:
    out = text
    for zh, en in ROMAN.items():
        out = out.replace(zh, en)
    return re.sub(r"\s{2,}", " ", CJK.sub("", out)).strip()


def key_file(kind: str, text: str) -> str:
    h = hashlib.sha1(text.encode("utf-8")).hexdigest()[:16]
    return f"{kind}/{h}.mp3"


def collect() -> tuple[set[str], set[str]]:
    """-> (chinese clips, english clips) wanted by the current content."""
    zh: set[str] = set()
    en: set[str] = set()

    chars = json.loads((CONTENT / "characters.json").read_text(encoding="utf-8"))["characters"]
    zh.update(chars.keys())

    lessons = json.loads((CONTENT / "lessons.json").read_text(encoding="utf-8"))
    for les in lessons["lessons"]:
        zh.update(les.get("changyong", []))
        zh.update(les.get("buchong", []))

    for path in sorted((CONTENT / "chapters").glob("*.json")):
        ch = json.loads(path.read_text(encoding="utf-8"))
        for tpl in ch.get("templates", {}).values():
            if tpl.get("en"):
                en.add(tpl["en"])
        for sc in ch.get("scenes", []):
            if sc.get("open"):
                en.add(sc["open"])
            for a in sc.get("actors", []):
                for field in ("intro", "reward"):
                    if a.get(field):
                        en.add(a[field])
                for step in a.get("script", []) or []:
                    if step.get("en"):
                        en.add(step["en"])
            fin = sc.get("finaleScript")
            if fin:
                en.update(fin.get("lines", []))
                for field in ("prompt", "after"):
                    if fin.get(field):
                        en.add(fin[field])

    # Templates with {a}/{b} placeholders cannot be pre-rendered; the runtime falls
    # back to speech synthesis for those specific lines.
    en = {t for t in en if "{" not in t}
    return zh, en


async def synth(items: list[tuple[str, str, str, str]], force: bool) -> int:
    import edge_tts  # imported late so --help works without the dependency

    made = 0
    for i, (text, voice, rate, rel) in enumerate(items, 1):
        dest = OUT / rel
        if dest.exists() and not force:
            continue
        dest.parent.mkdir(parents=True, exist_ok=True)
        try:
            await edge_tts.Communicate(text, voice, rate=rate).save(str(dest))
            made += 1
        except Exception as exc:  # noqa: BLE001 - one bad clip must not kill the run
            print(f"  ! {text[:40]!r}: {exc}", file=sys.stderr)
            continue
        if made % 25 == 0:
            print(f"  … {i}/{len(items)}")
    return made


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--force", action="store_true", help="regenerate clips that already exist")
    args = ap.parse_args()

    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8")
        except Exception:
            pass

    zh, en = collect()
    print(f"clips wanted: {len(zh)} zh · {len(en)} en")

    manifest: dict[str, str] = {}
    work: list[tuple[str, str, str, str]] = []
    for text in sorted(zh):
        rel = key_file("zh", text)
        manifest["zh:" + text] = rel
        work.append((text, ZH_VOICE, ZH_RATE, rel))
    for text in sorted(en):
        rel = key_file("en", text)
        manifest["en:" + text] = rel
        work.append((spoken(text), EN_VOICE, EN_RATE, rel))

    try:
        made = asyncio.run(synth(work, args.force))
    except ImportError:
        print(
            "edge-tts is not installed, so no audio was generated.\n"
            "  pip install edge-tts && python tools/gen_audio.py\n"
            "The game still runs: it falls back to the browser's own voice and says so "
            "in the header.",
            file=sys.stderr,
        )
        return

    # Only publish keys whose file actually exists, so a partial run degrades to
    # speech synthesis for the missing clips instead of silence.
    have = {k: v for k, v in manifest.items() if (OUT / v).exists()}
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "manifest.json").write_text(
        json.dumps({"voice": ZH_VOICE, "clips": have}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    total_mb = sum((OUT / v).stat().st_size for v in have.values()) / 1e6
    print(f"\n  generated {made} new clips")
    print(f"  manifest  {len(have)} / {len(manifest)} entries · {total_mb:.1f} MB")
    if len(have) < len(manifest):
        print("  ! some clips failed; the game falls back to browser speech for those",
              file=sys.stderr)


if __name__ == "__main__":
    main()
