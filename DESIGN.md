# 美洲華語 第一冊 — Learning RPG

A browser-based 2D role-playing game that teaches the vocabulary of 美洲華語 第一冊
(Meizhou Huayu, Book 1) to first graders at a US Sunday Chinese school.

Status: **design agreed, not yet built.** Next step is the 8-chapter story outline.

---

## 1. Audience

- **Age 6–7**, first grade. Book N maps to Grade N, so this game covers Book 1 only;
  older children play the game for the book their class is on.
- **Mixed heritage and non-heritage.** Some children hear Mandarin at home; others have
  never heard a tone. Assume **no fluency** as the baseline.
- **Early-reader English.** A 6-year-old reads English at roughly "the cat sat on the mat."
  All story text must be short and spoken aloud.

The game supplements Sunday class. It must never contradict or outpace what is taught
and graded there.

---

## 2. Curriculum source

All three source documents live in `References/` and have been read.

| File | Contents |
|---|---|
| `book_01_text.rtf` | 課文 — 16 lessons, 27 texts, 1,427 characters, 328 unique |
| `Book1_Radical.pdf` | 生字及部首對照表 — 110 生字 with 部首 for each |
| `B1_teaching_guide.pdf` | 教學指引 — 8 單元, per-lesson 生字/詞語/句型, 8 warm-up 故事, 8 人文學習目標, ACTFL objectives |

Books 2–12 will arrive later as RTFs. The RTF→data converter is therefore a **permanent
repo tool**, not a one-off script: each new book must be a command, not a rebuild.

### 2.1 Content tiers

Three tiers, only two graded.

| Tier | Count | Treatment |
|---|---|---|
| **生字** | 110 | Mastery-tracked, tested, scheduled for review. Chapter completion is measured against these. |
| **常用詞語** | 117 | Taught and used. Tested only as recognition inside the guide's own 句子練習 patterns. Never blocking. |
| **補充詞語** | 86 | Exposure only. Appears in dialogue and signage with audio and tap-to-hear gloss. Never tested. |

Rationale: 110 hard items is genuinely masterable across a school year. The 常用詞語 layer
rides along in context because single characters out of word context is a real weakness in
how Chinese is taught to children — a child who knows 上 but cannot read 上學 has not
learned much. The 補充詞語 tier is explicitly supplementary (補充 means exactly that);
testing it would invent requirements the curriculum did not set.

If the project runs long, **the 常用詞語 layer is the first thing to cut** — the 生字 tier
alone fully satisfies what the school grades.

### 2.2 生字 by lesson

| Lesson | 生字 | Count |
|---|---|---|
| 1 | 一 二 三 四 五 | 5 |
| 2 | 六 七 八 九 十 百 千 | 7 |
| 3 | 上 中 下 大 小 手 力 | 7 |
| 4 | 工 口 左 右 有 尖 不 | 7 |
| 5 | 木 山 火 水 林 月 土 | 7 |
| 6 | 天 生 日 卡 早 也 紅 | 7 |
| 7 | 雲 花 雨 白 多 少 的 | 7 |
| 8 | 石 風 沙 明 子 足 玩 | 7 |
| 9 | 人 來 米 田 是 沒 我 | 7 |
| 10 | 星 在 坐 去 肚 和 肉 | 7 |
| 11 | 目 耳 舌 牙 心 好 正 | 7 |
| 12 | 雪 地 竹 你 他 看 見 | 7 |
| 13 | 哭 笑 叫 唱 走 巴 了 | 7 |
| 14 | 比 李 刀 位 呀 草 象 | 7 |
| 15 | 交 朋 友 隻 校 女 男 | 7 |
| 16 | 姓 言 立 江 禾 這 那 | 7 |

**Discrepancy to resolve with a teacher:** `Book1_Radical.pdf` includes 百 and 千 in
Lesson 2 (110 total); the 教學指引's `課文生字` line omits them (108 total). The 課文
一握握手 uses both, and the 句子練習 teaches 十/百/千, so 110 is used above. Needs a ruling.

### 2.3 部首 extraction

`Book1_Radical.pdf` is a single-page table, machine-parseable via `pdfplumber` word
coordinates (lessons at fixed x-offsets, 生字/部首 column pairs). Three quirks the
converter must handle:

1. **Doubled glyphs** on the last row of the first block (力力, 土土, 的的, 我我, 正正,
   了了, 男男) — a bold-rendering artifact. Deduplicate.
2. **Radicals with descriptive suffixes** — 交→`亠頭`, 這→`辵綽`, 去→`ㄙ司`, 了→`亅孓`.
   Take the first character.
3. **A stray 滾** adjacent to 中's radical 丨. Ignore; 中's radical is 丨.

Radical assignments follow 新編國語日報辭典 (table compiled by 趙綺平). Output should be
verified by a teacher before the 字典 feature ships.

### 2.4 Sentence patterns

Cloze templates are taken **verbatim** from the guide's 句子練習 — they are not invented:

`我姓＿＿，我叫＿＿＿` · `..是..` · `沒有` · `..和..` · `..在..` · `正在` · `..不見了` ·
`..比..` · `..比一比..` · `我想去…` · `很多 / 很少 / 多少` · `..有..也有..` ·
`尖尖的 / 圓圓的 / 方方的 / 彎彎的`

---

## 3. Game design

### 3.1 Premise

An English-language top-down 2D RPG with light encounters. Chinese appears as
fill-in-the-blank. The player is a child new to Chinese school who **cannot read yet** —
so every blank is diegetic: *you* cannot read the sign either, and learning the character
is literally how you get past it.

English carries the story so non-heritage children are never locked out; the Chinese is
the interactive part rather than the barrier.

### 3.2 Structure

**8 chapters = the 8 單元.** Each chapter *is* that unit's 故事, with both lessons' 生字
woven into playing it, the unit's 人文學習目標 as the plot's actual resolution, and a
companion earned.

- ~60 minutes per chapter (a unit is two lessons and 6–9 教學時數 of class)
- **3 savable scenes of ~20 minutes** — one homework sitting is one scene
- ~8 hours total

| Ch | 單元 | 生字 | 故事 | 人文目標 | Companion |
|---|---|---|---|---|---|
| 1 | 1 | L1 + L2 | 少了一頭驢 | 細心 | 小小 |
| 2 | 2 | L3 + L4 | 氣球飛上天 | 作夢 | 小石, 小豬 |
| 3 | 3 | L5 + L6 | 森林大火 | 保護環境 | 小松鼠 |
| 4 | 4 | L7 + L8 | 下雨天真好玩兒 | 樂觀 | 中中 |
| 5 | 5 | L9 + L10 | 紅雞媽媽 | 幫忙 | 猴子, 一粒米 |
| 6 | 6 | L11 + L12 | 眉毛搬家 | 說謝謝 | 雪人 (briefly) |
| 7 | 7 | L13 + L14 | 我的手拿不出來了 | 安全 | — |
| 8 | 8 | L15 + L16 | 小狗的早飯 | 愛護動物 | 明明, 友友, 江禾中, 小狗 |

Full chapter-by-chapter treatment is in [`OUTLINE.md`](./OUTLINE.md), approved.

The 8 故事 are the teacher's 暖身活動 — narrated in class before the lessons. Putting them
in the game means a child who played the donkey story on Saturday and hears 老師 tell it
on Sunday gets a jolt of recognition that no amount of polish buys.

Note the sequencing asymmetry: class hears the story **before** the lessons; a child doing
homework has already had the lesson. The game must assume neither total ignorance nor
mastery — the no-fail design and costed hints handle this.

### 3.3 Story spine

**我的朋友在哪裡 → 什麼是朋友 → 我和我的朋友.**

You are alone and looking for a friend, across one year. You do not find them by
searching — you find them by collecting friends along the way. The final scene is you
introducing everyone by name using Lesson 16's own 句型.

The cast is the textbook's own: **小小, 中中, 明明 (言立明), 林友友, 江禾中, 小石**.
Class already knows them.

The 8 人文目標 are what each chapter is *about*. That is a stronger moral spine than one
we would write, and the school already endorses it.

春節 and 中秋 are included (the story spans a full year). Chinese folk-religious imagery
is welcome — 土地公 by the rice field, temple gates, 春節 door gods. No proselytizing
content of any kind.

### 3.4 Encounters

**Contests, not combat.** Nobody gets hurt and nothing dies. The 老虎 challenges you; you
do not fight it.

**No failure state, ever.** Wrong answers cost coins and re-queue the character into the
review pool. A child cannot lose.

> This is homework a parent is nagging them to do. If losing is possible, the child's
> model becomes "I'm bad at Chinese" rather than "I haven't learned that one yet," and
> that belief is far harder to undo than any vocabulary gap.

**No leaderboards, no cross-child comparison, no visible difficulty label.** The gap
between heritage and non-heritage children in one classroom is exactly the gap not to make
public. The only thing a child competes with is their own last run.

**Difficulty adapts quietly** via the mastery model — never as a setting a parent picks
or a tier a child can name:

- distractor count (2 → 4)
- distractor similarity (山/水 is easy; 山/出 is hard)
- hint cost
- review interval

Adaptation cannot fix a four-year gap in spoken Mandarin. If a heritage child finds Book 1
trivial, the answer is that they should be playing the Book 2 game — an argument for
building Book 2 sooner, not for making Book 1 cleverer.

### 3.5 Mechanic progression

Mechanics follow the curriculum's own stated objectives, so the game changes shape exactly
when the book gives it a new idea:

| Ch | Mechanic | Curriculum objective |
|---|---|---|
| 1 | Answer-to-attack; 加減法 | 學生會說一到五數字範圍內的加減法數學式 (一加三等於四) |
| 2 | Direction and position | 學生能依照動作及口令比出上中下左右 |
| 3 | **象形 pictograph morphing** | 學生看到本課生字的象形圖像（如水、山、火等）能讀寫出生字 |
| 4 | **猜拳** (rock/paper/scissors) | 學生看到猜拳的手勢會說手勢的名稱（剪刀石頭布） |
| 5 | **拼字 composition** | 學生會做拼字練習（月＋土＝肚，日＋生＝星，人＋人＋土＝坐） |
| 6 | Five senses; weather | 學生能看簡單天氣圖說出天氣形式 |
| 7 | **量詞** word-building | 學生能初步認識中文的量詞，加以運用 |
| 8 | **部件 radical sorting** | 學生能將學過的字依照「人」、「水」、「草」、「肉」的部件做分類 |

Balance shifts across the game: **story-forward early** (there is nothing to review in
Chapter 1, and the child needs hooking), **review-forward late** (~70/30 story:review at
Ch1, flipping toward 40/60 by Ch8). Per-character mastery is tracked from Chapter 1, and
review is woven into ordinary encounters — the squirrel asking you to count acorns *is*
the review. **The child never sees a screen labelled "quiz."**

### 3.6 字典 — the collection screen

Built **after Chapter 1 ships.** It is the highest delight-per-hour feature in the project
and almost all its content is data already in hand — but it is not what makes Chapter 1
good, and building it first is how the engine ends up with a beautiful dictionary and no
game attached.

110 cards. Each collected character shows:

- **部首** (from `Book1_Radical.pdf`)
- **Stroke-order animation** — `hanzi-writer` (MIT) with Make Me a Hanzi data
  (Arphic Public License, attribution only); traditional coverage confirmed
- **象形 origin morph** for the pictographic characters (山 火 水 木 日 月 目 耳 田 米 人)
- **常用詞語 it appears in**, linked both ways
- Audio, 注音 + 拼音, and which chapter it was found in

Grouped by radical — which *is* the Lesson 15 sorting objective, so the exercise and the
collection screen are the same thing.

**On writing:** every lesson's objective is 聽、說、讀、寫. The game covers 聽說讀; the
workbook covers 寫. The stroke-order animation shows how the writing goes **without
pretending to grade it** — a trackpad is a terrible pen, and the workbook already does
this properly.

---

## 4. Presentation

### 4.1 Characters and phonetics

- **Traditional characters only.**
- The school teaches **both 注音符號 and 漢語拼音**, so both are stored in the data and
  **both are shown in the hint**. A toggle can restrict to one if a teacher prefers.
- Phonetic readings are **hidden by default**, revealed by a **costed hint button** —
  using one still lets you pass, but you earn less and the character resurfaces sooner.

> Always-visible phonetics is the single most common failure mode of Chinese learning apps:
> the child reads the pinyin, never looks at the character, and learns nothing. A hint that
> is available but costly is what makes a child try to remember first — which is the entire
> mechanism by which spaced repetition works.

### 4.2 Art

Budget is zero. All assets must be free.

- **Environments:** CC0 tilesets (Kenney.nl and similar) for ~10 environments — mountain,
  orchard, schoolyard, home, night forest, rice field, market, park/beach, snow field,
  mirror hall. Verify CC0 specifically; LPC is CC-BY-SA and carries obligations.
- **Characters:** original flat-shape designs for ~18 sprites. Chosen over AI-generated
  sprite sheets deliberately — AI demos beautifully and then Chapter 5's rice field does
  not match Chapter 2's orchard, with no way to fix it but redoing everything.
- Everything sits behind an **asset manifest**, so a commissioned set can drop in later as
  a swap rather than a rewrite.
- **Later feature:** children draw their own character. Lesson 4 is literally 畫張畫～小豬,
  and a child whose drawing became the game character cares in a way no asset achieves.

### 4.3 Audio

- **Chinese:** pre-generated **zh-TW** MP3s committed to the repo (~475 clips, ~8 MB).
  zh-TW specifically — 美洲華語 is a Taiwan-lineage curriculum, and a mainland voice
  reading it will sound subtly wrong to exactly the heritage parents most likely to judge
  this. Runtime browser TTS was rejected: voice availability is per-device and the failure
  mode is a button that silently does nothing.
- **English:** story lines also pre-voiced. Short lines, spoken aloud, **replay button on
  every line** — a 6-year-old cannot read a melting-snowman paragraph either. This also
  makes the game usable by a child with dyslexia, who in a class of twelve is probably one
  of them.
- **Music/SFX:** free CC0 sources (Kenney audio packs, incompetech). A quiet loop per
  environment and simple UI sounds; their absence makes a game feel broken.
- Every clip is referenced through a **manifest keyed on character/word**, so a teacher
  recording 虎.mp3 later is a file replacement.

### 4.4 Player identity

- Types their **English name** (a 6-year-old can type their own name — it is the first
  thing they learn to write).
- Optionally picks a real **Chinese 姓名** from a character grid, with a parent's help.
  Never typed — a 6-year-old cannot type 漢字, and pinyin input is beyond them.
- Avatar picker: a few body/hair/colour options, not a character creator.
- Lesson 16 works either way. **我叫 Emma** is what half these children genuinely say in
  real life — it is accurate, not a fallback.

---

## 5. Technical

### 5.1 Stack

**Phaser 3 + TypeScript + Vite.** Chosen for tilemap support, Chromebook performance, and
because the whole project is plain text files. Godot's web export ships a 15–25 MB WASM
runtime that is sluggish on school Chromebooks.

**All game content lives in commented data files containing zero code.** A new chapter is a
data file; the engine is never edited to add one. Book 2 is 16 new data files, not a new
build.

### 5.2 Hosting

**Private GitHub repo → Cloudflare Pages.** GitHub Pages' free tier requires a *public*
repo; Cloudflare Pages and Netlify both deploy from private repos for free. `noindex` plus
an unguessable URL.

Note what a private repo does and does not do: it keeps the 課文 out of public GitHub
search, but the game is static files, so the lesson data is downloadable by anyone who has
the URL. The site is public; the source is not.

### 5.3 Progress and privacy

- `localStorage`, **multi-profile** from day one (siblings sharing a laptop; a classroom
  device used by several children).
- **Export/import save code** so a wiped device is recoverable.
- **No backend, no accounts, no teacher dashboard.** Nothing about a child ever leaves
  their device — including the Chinese name from §4.4.

A teacher dashboard would require storing data about identified minors, which drags in
COPPA and the school's stance on student data. That is a governance decision for the
school, not a technical one. The zero-infrastructure substitute: a chapter-completion
screen showing the child's name, the chapter, and which characters gave them trouble,
which a parent can screenshot and send.

### 5.4 Offline

Service worker + cached audio, **after Chapter 2** — once the asset list has stopped
moving. Also makes repeat loads instant.

---

## 6. Copyright posture

美洲華語 is a copyrighted, commercially published curriculum. The 課文 appears in the game
as the chapter payoff, which is the correct pedagogy and also reproduction of someone's
textbook.

What softens it:

- **Individual characters and 生字 lists are not copyrightable.** 虎 is not anyone's
  property, and a list of which characters a first grader learns is close to
  uncopyrightable fact. The game's core — recognition, review, original story — carries
  essentially no risk.
- **Several 課文 are public-domain folk rhymes** far older than this textbook
  (一二三四五，上山找老虎; 握握手). The textbook compiled them; it did not write them all.
  Others (什麼是朋友, 我和我的朋友) read as original textbook prose.
- **The use is about as favourable as fair use gets** — non-commercial, educational, for
  students whose school already bought the books, supplementing rather than substituting
  for the purchase.
- Site is unlisted and not search-indexed.

**Action item:** tell the school what is being built. It costs nothing and turns "a parent
republished our textbook" into "our school built a supplement for our students," which is
a completely different conversation if anyone ever raises it. It is also the conversation
that yields the CD audio, the 生字 ruling, and teacher voice recordings.

---

## 7. Build sequence

1. **8-chapter outline** — one paragraph each, reviewed before any code. Chapter 1's tone
   and mechanics should be set by where the story ends up, not by what is convenient in
   week one.
2. **Encounter prototype** — one screen, one character, hint button, audio, no-fail
   feedback. Reviewable within a single working session. If the core interaction is wrong,
   that costs an afternoon instead of three weeks.
3. **Chapter 1 complete**, deployed to a real URL.
4. **Chapters 2–8**, script-then-build, one at a time.
5. 字典 collection screen after Ch1; offline support after Ch2.

Review workflow: high-level outline once, then full scripts just-in-time, chapter by
chapter.

---

## 8. Open questions

| # | Question | Blocking? |
|---|---|---|
| 1 | **Does the CD exist?** Every lesson's first objective is 學生能跟著ＣＤ唱課文 — these 課文 are *songs the children already sing*. Official audio would beat TTS outright: real voices, correct pronunciation, and the actual melodies. One question to the school. The audio manifest makes it a drop-in swap. | No — plan for TTS |
| 2 | **110 or 108 生字?** See §2.2. Needs a teacher's ruling on 百/千. | No — using 110 |
| 3 | **生字表 cross-check.** The lists in §2.2 come from the 教學指引 and are cross-verified against `Book1_Radical.pdf`. A teacher confirming them closes the loop. | No |
| 4 | **Tell the school.** See §6. | No |
| 5 | **No test child available.** Noted and accepted. The single most valuable input to this project would be watching one 6-year-old play Chapter 1 unassisted for ten minutes; until that is possible, every design decision here remains a hypothesis. | No |

---

## 9. Decisions deliberately rejected

Recorded so they are not silently revisited.

| Rejected | Why |
|---|---|
| Speech recognition / mic scoring | Browser Mandarin ASR on a 6-year-old's voice is unreliable enough to make children feel they failed when they did not |
| Graded handwriting | A trackpad is a terrible pen; the workbook does this properly. Stroke-order animation as reference only |
| Runtime browser TTS | Per-device voice availability; silent-failure audio is worse than no audio button |
| AI-generated sprite sheets as the primary art plan | Style consistency across 18 characters and 10 environments is unachievable; failure is discovered late and unfixable |
| Teacher dashboard / cloud sync | Requires storing data about identified minors; a school governance decision, not ours |
| Visible difficulty setting | Labels a 6-year-old in a class where children talk to each other |
| Leaderboards | Makes the heritage/non-heritage gap public |
| Failure states | Teaches "I'm bad at Chinese" instead of "I haven't learned that one yet" |
| Timed countdowns | Anxiety is poison for a struggling non-heritage child |
| Always-visible phonetics | The child reads the pinyin and never looks at the character |
| Chapter = lesson (16 chapters) | The curriculum is organised in 8 單元, each with one 故事 and one 人文目標. Sixteen chapters fragments both |
| Invented animal companions | The textbook has its own recurring cast (小小, 中中, 明明, 友友, 小石) that the class already knows |
