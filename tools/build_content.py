#!/usr/bin/env python3
"""
Build content/characters.json and content/lessons.json from the source PDFs.

Sources (References/):
  Book1_Radical.pdf     生字及部首對照表  -> 生字 + 部首, per lesson
  B1_teaching_guide.pdf 教學指引          -> 生字 / 常用詞語 / 補充詞語 per lesson,
                                            plus 單元 stories and 人文學習目標

Phonetics (注音 + 拼音) come from pypinyin. English glosses are hand-authored: the
GLOSSES table below seeds them, and any gloss already present in characters.json is
preserved on re-run, so editing the JSON is safe.

    pip install pdfplumber pypinyin
    python tools/build_content.py

This is a permanent tool, not a one-off: Books 2-12 arrive as the same document set.
"""

from __future__ import annotations

import json
import re
import sys
import unicodedata
from pathlib import Path

import pdfplumber
from pypinyin import Style, pinyin

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8")   # Windows consoles default to cp1252
    except Exception:
        pass

ROOT = Path(__file__).resolve().parent.parent
REF = ROOT / "References"
OUT = ROOT / "content"

CJK = re.compile(r"[一-鿿]")          # one character


def norm(t: str) -> str:
    """NFC-normalise text coming out of a PDF.

    One row per lesson in the radical table is typeset in a 注音 font variant
    (DFPBiaoKai-W5-ZhuIn) that encodes characters as CJK Compatibility Ideographs
    -- 力 arrives as U+F98A, not U+529B -- which no ordinary CJK range test matches.
    NFC maps the compatibility block back onto the unified ideographs.
    """
    return unicodedata.normalize("NFC", t)
CJK_WORD = re.compile(r"[一-鿿]+")     # a whole word
LESSON_NUMERALS = "一二三四五六七八九十"

# --- hand-authored layer -----------------------------------------------------
# Short, child-facing glosses. Not a dictionary definition: the shortest true thing
# a 6-year-old can hold on to. Edited in content/characters.json thereafter.
GLOSSES = {
    "一": "one", "二": "two", "三": "three", "四": "four", "五": "five",
    "六": "six", "七": "seven", "八": "eight", "九": "nine", "十": "ten",
    "百": "a hundred", "千": "a thousand",
    "上": "up, on top", "中": "middle", "下": "down, under", "大": "big",
    "小": "small", "手": "hand", "力": "strength",
    "工": "work", "口": "mouth", "左": "left", "右": "right", "有": "to have",
    "尖": "pointed", "不": "not",
    "木": "tree, wood", "山": "mountain", "火": "fire", "水": "water",
    "林": "woods", "月": "moon, month", "土": "earth, soil",
    "天": "sky, day", "生": "to be born", "日": "sun, day", "卡": "card",
    "早": "early, morning", "也": "also", "紅": "red",
    "雲": "cloud", "花": "flower", "雨": "rain", "白": "white",
    "多": "many", "少": "few", "的": "'s (belongs to)",
    "石": "stone", "風": "wind", "沙": "sand", "明": "bright, next",
    "子": "child", "足": "foot", "玩": "to play",
    "人": "person", "來": "to come", "米": "rice", "田": "field",
    "是": "to be", "沒": "not have", "我": "I, me",
    "星": "star", "在": "at, in", "坐": "to sit", "去": "to go",
    "肚": "belly", "和": "and", "肉": "meat",
    "目": "eye", "耳": "ear", "舌": "tongue", "牙": "tooth",
    "心": "heart", "好": "good", "正": "upright, right now",
    "雪": "snow", "地": "ground", "竹": "bamboo", "你": "you",
    "他": "he, him", "看": "to look", "見": "to see",
    "哭": "to cry", "笑": "to laugh", "叫": "to call", "唱": "to sing",
    "走": "to walk", "巴": "mouth (嘴巴)", "了": "done, finished",
    "比": "to compare", "李": "plum", "刀": "knife", "位": "(one person)",
    "呀": "oh!", "草": "grass", "象": "elephant",
    "交": "to make (friends)", "朋": "friend", "友": "friend",
    "隻": "(one animal)", "校": "school", "女": "girl", "男": "boy",
    "姓": "family name", "言": "words", "立": "to stand", "江": "river",
    "禾": "grain", "這": "this", "那": "that",
}

# Characters whose shape still shows the thing they mean. Lesson 5's objective:
# 學生看到本課生字的象形圖像（如水、山、火等）能讀寫出生字
PICTOGRAPHS = set("山火水木日月目耳田米人口手雨竹刀")

# Visually or numerically confusable pairs -> the "hard" distractor pool.
# Hand-curated: this is a teaching judgement, not something to derive.
NEAR = {
    "一": ["二", "三", "十"], "二": ["一", "三"], "三": ["一", "二"],
    "四": ["五", "三"], "五": ["四", "六"], "六": ["八", "七"],
    "七": ["九", "十", "一"], "八": ["六", "七"], "九": ["七", "十"],
    "十": ["千", "七", "一"], "百": ["千", "白"], "千": ["十", "百"],
    "上": ["下", "土"], "下": ["上", "不"], "大": ["天", "太", "人"],
    "小": ["少", "尖"], "手": ["毛"], "力": ["刀"],
    "工": ["土", "上"], "口": ["日", "目"], "左": ["右"], "右": ["左", "石"],
    "有": ["月"], "尖": ["小"], "不": ["下"],
    "木": ["林", "禾", "本"], "山": ["出"], "火": ["水"], "水": ["火", "永"],
    "林": ["木"], "月": ["目", "有"], "土": ["士", "上", "工"],
    "天": ["大", "夫"], "生": ["主"], "日": ["目", "白", "口"], "卡": ["上", "下"],
    "早": ["旱"], "也": ["他"], "紅": ["江"],
    "雲": ["雪", "雨"], "花": ["草"], "雨": ["雲", "雪"], "白": ["百", "日"],
    "多": ["夕"], "少": ["小"], "的": ["白"],
    "石": ["右"], "風": ["雨"], "沙": ["少"], "明": ["日", "月"],
    "子": ["了"], "足": ["走"], "玩": ["元"],
    "人": ["入", "八"], "來": ["米"], "米": ["來", "木"], "田": ["由", "甲"],
    "是": ["早"], "沒": ["水"], "我": ["找"],
    "星": ["日", "生"], "在": ["土"], "坐": ["土"], "去": ["土"],
    "肚": ["土", "月"], "和": ["禾", "口"], "肉": ["內"],
    "目": ["日", "自", "耳"], "耳": ["目"], "舌": ["古"], "牙": ["才"],
    "心": ["必"], "好": ["女"], "正": ["止"],
    "雪": ["雲", "雨"], "地": ["土", "也"], "竹": ["個"], "你": ["他"],
    "他": ["你", "也"], "看": ["目"], "見": ["貝", "目"],
    "哭": ["笑"], "笑": ["哭", "竹"], "叫": ["口"], "唱": ["口"],
    "走": ["足"], "巴": ["把", "色"], "了": ["子"],
    "比": ["北"], "李": ["木", "子"], "刀": ["力"], "位": ["立", "人"],
    "呀": ["牙", "口"], "草": ["花", "早"], "象": ["家"],
    "交": ["文"], "朋": ["月"], "友": ["有", "右"], "隻": ["雙"],
    "校": ["木", "交"], "女": ["好"], "男": ["田", "力"],
    "姓": ["生", "女"], "言": ["音"], "立": ["位"], "江": ["紅", "工"],
    "禾": ["木", "和"], "這": ["那"], "那": ["這"],
}


def clean_cell(text: str) -> str:
    """Radical-table cells arrive with two artefacts: bold glyphs doubled (力力),
    and radicals carrying a descriptive suffix (交 -> 亠頭, 這 -> 辵綽)."""
    t = "".join(CJK.findall(text) or list(text))
    if not t:
        t = text.strip()
    if len(t) >= 2 and len(t) % 2 == 0 and t[: len(t) // 2] == t[len(t) // 2:]:
        t = t[: len(t) // 2]
    return t[:1]


def parse_radicals(pdf_path: Path) -> dict[int, list[tuple[str, str]]]:
    """-> {lesson_no: [(生字, 部首), ...]}

    The table is one page, two blocks of eight lesson columns (odd lessons above,
    even below). Columns sit at fixed x; reading each column top-to-bottom is far
    more robust than trying to reconstruct rows, because a few radicals sit one
    row off from the character they belong to.
    """
    bases = [85, 164, 243, 322, 401, 480, 559, 638]

    with pdfplumber.open(pdf_path) as pdf:
        page = pdf.pages[0]
        words = page.extract_words(x_tolerance=1.2, y_tolerance=1.2)
        # NB: a glyph's text is not always one character. The table's bold row is
        # drawn with a font whose ToUnicode map yields the character twice ("力力"),
        # so requiring a single character silently drops one pair per lesson.
        glyphs = [dict(c, text=norm(c["text"])) for c in page.chars]
        glyphs = [c for c in glyphs if CJK.match(c["text"])]

    def header(label: str) -> float:
        m = next((w for w in words if w["text"].startswith(label)), None)
        if m is None:
            raise SystemExit(f"radical table: could not find the {label} block header")
        return m["top"]

    top1, top2 = header("第一課"), header("第二課")

    # Work per glyph, not per word: the cells are tight enough that extract_words
    # welds neighbouring columns together (三一下一火火雨雨 in one token).
    # Dedupe first — bold glyphs are painted twice at the same spot (力力).
    seen, uniq = set(), []
    for c in glyphs:
        key = (c["text"], round(c["x0"] / 3), round(c["top"] / 3))
        if key in seen:
            continue
        seen.add(key)
        uniq.append(c)

    def rows_of(pool: list[dict]) -> list[list[dict]]:
        pool = sorted(pool, key=lambda c: c["top"])
        out: list[list[dict]] = []
        for c in pool:
            if out and abs(c["top"] - out[-1][0]["top"]) <= 7:
                out[-1].append(c)
            else:
                out.append([c])
        return out

    # The column-header row (生字 | 部首) repeats above every block. Exclude it by
    # position, never by content: lesson 6 teaches 生, and filtering that character
    # out would delete a real entry.
    header_tops = [w["top"] for w in words if w["text"] in ("生字", "部首")]

    def is_header_row(top: float) -> bool:
        return any(abs(top - h) <= 6 for h in header_tops)

    out: dict[int, list[tuple[str, str]]] = {}

    for block, lessons in ((0, [1, 3, 5, 7, 9, 11, 13, 15]), (1, [2, 4, 6, 8, 10, 12, 14, 16])):
        lo, hi = (top1, top2) if block == 0 else (top2, 1e9)
        # +10 clears the block's own header row, and with it the document title
        # and the compiler's byline, which sit at column x-positions.
        pool = [c for c in uniq if lo + 10 < c["top"] < hi]
        for i, lesson in enumerate(lessons):
            base = bases[i]
            pairs: list[tuple[str, str]] = []
            for row in rows_of(pool):
                if is_header_row(row[0]["top"]):
                    continue
                row.sort(key=lambda c: c["x0"])
                # leftmost glyph in each window: drops the descriptive suffix on
                # radicals (亠頭 -> 亠, 辵綽 -> 辵) and the stray 滾 beside 中's 丨
                ch = next((c["text"][0] for c in row if base - 10 <= c["x0"] < base + 28), None)
                rad = next((c["text"][0] for c in row if base + 30 <= c["x0"] < base + 70), None)
                if ch and rad:
                    pairs.append((ch, rad))
            expected = 5 if lesson == 1 else 7
            if len(pairs) != expected:
                print(f"  ! lesson {lesson}: {len(pairs)} pairs, expected {expected}"
                      f" -> {''.join(c for c, _ in pairs)}", file=sys.stderr)
            out[lesson] = pairs
    return out


LABELS = ("課文生字", "常用詞語", "補充詞語", "句子練習")


def parse_guide(pdf_path: Path) -> dict:
    """The guide is a two-column table. Reading it as flowed text mis-pairs labels
    with values: on some pages the value box sits ~6pt above its label, which a
    line-reconstructing extractor resolves the wrong way. Pair by coordinate instead:
    a label owns every value row from just above itself up to just above the next label.
    """
    cells: dict[str, list[str]] = {k: [] for k in LABELS}

    with pdfplumber.open(pdf_path) as pdf:
        pages_text = []
        for page in pdf.pages:
            pages_text.append(norm(page.extract_text() or ""))
            words = [dict(w, text=norm(w["text"]))
                     for w in page.extract_words(x_tolerance=1.5, y_tolerance=1.5)]
            labels = sorted((w for w in words if w["text"] in LABELS), key=lambda w: w["top"])
            values = [w for w in words if w["x0"] > 120]
            for i, lab in enumerate(labels):
                lo = lab["top"] - 12
                hi = labels[i + 1]["top"] - 12 if i + 1 < len(labels) else 1e9
                rows = [w for w in values if lo <= w["top"] < hi]
                rows.sort(key=lambda w: (w["top"], w["x0"]))
                cells[lab["text"]].append(" ".join(w["text"] for w in rows))

    text = "\n".join(pages_text)

    def words_of(raw: str) -> list[str]:
        return [w for w in re.split(r"[、,，\s]+", raw) if w and CJK_WORD.fullmatch(w)]

    sheng = [words_of(c) for c in cells["課文生字"]]
    chang = [words_of(c) for c in cells["常用詞語"]]
    bu = [words_of(c) for c in cells["補充詞語"]]
    patterns = [c.strip() for c in cells["句子練習"]]

    # The guide misprints 眉毛搬家 (unit 6) as 眉毛般家. Correct known source typos
    # here, so that a rebuild never reintroduces them into the game data.
    source_typos = {"眉毛般家": "眉毛搬家"}
    stories = [source_typos.get(s.strip(), s.strip())
               for s in re.findall(r"故事[:：]\s*([^\n（(]+)", text)]
    virtues = [v.strip() for v in re.findall(r"人文學習目標[:：]\s*（([^）]+)）", text)]

    for name, got in (("課文生字", sheng), ("常用詞語", chang), ("補充詞語", bu)):
        if len(got) != 16:
            print(f"  ! expected 16 {name} cells, found {len(got)}", file=sys.stderr)
    for name, got in (("故事", stories), ("人文學習目標", virtues)):
        if len(got) != 8:
            print(f"  ! expected 8 {name}, found {len(got)}", file=sys.stderr)

    return {"sheng": sheng, "chang": chang, "bu": bu, "patterns": patterns,
            "stories": stories, "virtues": virtues}


def phon(ch: str) -> tuple[str, str]:
    return (pinyin(ch, style=Style.TONE)[0][0], pinyin(ch, style=Style.BOPOMOFO)[0][0])


def main() -> None:
    rad_pdf = REF / "Book1_Radical.pdf"
    guide_pdf = REF / "B1_teaching_guide.pdf"
    for p in (rad_pdf, guide_pdf):
        if not p.exists():
            raise SystemExit(f"missing source: {p}")

    print("reading 生字及部首對照表 …")
    rads = parse_radicals(rad_pdf)
    print("reading 教學指引 …")
    guide = parse_guide(guide_pdf)

    OUT.mkdir(exist_ok=True)
    existing = {}
    cpath = OUT / "characters.json"
    if cpath.exists():
        existing = json.loads(cpath.read_text(encoding="utf-8")).get("characters", {})

    characters: dict[str, dict] = {}
    lessons: list[dict] = []
    total = 0

    for n in range(1, 17):
        pairs = rads.get(n, [])
        unit = (n + 1) // 2
        for ch, rad in pairs:
            py, bpmf = phon(ch)
            prev = existing.get(ch, {})
            characters[ch] = {
                "pinyin": py,
                "bpmf": bpmf,
                "en": prev.get("en") or GLOSSES.get(ch, ""),
                "radical": rad,
                "lesson": n,
                "unit": unit,
                "pictograph": ch in PICTOGRAPHS,
                "near": NEAR.get(ch, []),
            }
            total += 1

        idx = n - 1
        lessons.append({
            "lesson": n,
            "unit": unit,
            "shengzi": [c for c, _ in pairs],
            "shengzi_guide": guide["sheng"][idx] if idx < len(guide["sheng"]) else [],
            "changyong": guide["chang"][idx] if idx < len(guide["chang"]) else [],
            "buchong": guide["bu"][idx] if idx < len(guide["bu"]) else [],
            "patterns": guide["patterns"][idx] if idx < len(guide["patterns"]) else "",
        })

    units = []
    for u in range(1, 9):
        units.append({
            "unit": u,
            "lessons": [u * 2 - 1, u * 2],
            "story": guide["stories"][u - 1] if u - 1 < len(guide["stories"]) else "",
            "virtue": guide["virtues"][u - 1] if u - 1 < len(guide["virtues"]) else "",
        })

    missing = [c for c, v in characters.items() if not v["en"]]
    mismatch = [l["lesson"] for l in lessons
                if l["shengzi_guide"] and set(l["shengzi_guide"]) - set(l["shengzi"])]

    cpath.write_text(json.dumps({
        "_source": "美洲華語 第一冊 · Book1_Radical.pdf + B1_teaching_guide.pdf",
        "_note": "Phonetics generated by pypinyin. Glosses hand-authored and preserved on rebuild. "
                 "Radicals per 新編國語日報辭典 (趙綺平製表) — pending teacher verification.",
        "count": total,
        "characters": characters,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    (OUT / "lessons.json").write_text(json.dumps({
        "_source": "美洲華語 第一冊 · B1_teaching_guide.pdf",
        "book": 1,
        "units": units,
        "lessons": lessons,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"\n  characters.json  {total} 生字")
    print(f"  lessons.json     16 lessons, 8 units")
    print(f"  常用詞語 {sum(len(l['changyong']) for l in lessons)}"
          f" · 補充詞語 {sum(len(l['buchong']) for l in lessons)}")
    if missing:
        print(f"  ! no gloss for: {' '.join(missing)}", file=sys.stderr)
    if mismatch:
        print(f"  ! radical table and 教學指引 disagree on lessons: {mismatch}", file=sys.stderr)
        print("    (expected for lesson 2 — the table lists 百/千, the guide's 生字 line omits them)",
              file=sys.stderr)


if __name__ == "__main__":
    main()
