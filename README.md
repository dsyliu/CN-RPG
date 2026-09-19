# 美洲華語 第一冊 — a learning RPG

A browser game that teaches the vocabulary of **美洲華語 第一冊** to first graders at a
US Sunday Chinese school. You walk a mountain road, and the way past whoever is blocking
it is to read the character.

- **[DESIGN.md](DESIGN.md)** — what was decided and why, including what was rejected
- **[OUTLINE.md](OUTLINE.md)** — the eight-chapter story, approved
- **[docs/CONTENT.md](docs/CONTENT.md)** — how to write a chapter

Chapter 1 (單元 1 · 少了一頭驢 · 細心) is playable: three scenes, all 12 of Lesson 1–2's
生字, real zh-TW audio.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
```

Arrow keys or WASD to walk, `SPACE` to talk. On a tablet there is an on-screen pad.

```bash
npm run build        # typecheck + production build into dist/
npm run content      # rebuild characters.json + lessons.json from References/*.pdf
npm run audio        # pre-generate the zh-TW and English clips
```

`npm run content` and `npm run audio` need Python:
`pip install pdfplumber pypinyin edge-tts`.

## How it is put together

```
content/          all game content, served as static files — edit and reload, no rebuild
  characters.json   110 生字 with 注音 · 拼音 · 部首 · gloss        generated
  lessons.json      16 lessons, 8 units, 詞語, 故事, 人文目標      generated
  chapters/         one file per chapter                          hand-written
  audio/            330 mp3 clips + manifest.json                  generated
src/              the engine. Never needs editing to add a chapter.
  world.ts          Phaser scene: map, party, actors, scene flow
  encounters.ts     turns a script step into a question
  mastery.ts        mastery model, review scheduler, distractor choice
  dialogue.ts       the dialogue box and the answer UI
  profile.ts        localStorage, multi-profile, export/import save code
  audio.ts          manifest-first playback, browser speech as fallback
tools/            build_content.py, gen_audio.py — permanent, for Books 2–12
References/       the source PDFs and 課文
```

The split is the point: **a new chapter is a data file, not code.** When Book 2 arrives
it is `npm run content` plus sixteen new chapter files.

## Three things that are load-bearing

**Questions come from the world where they can.** When 老虎 asks how many donkeys you
have, the answer is the herd walking behind you — the dialogue box deliberately sits low
so the road stays visible, and the camera lifts while you are talking. A question you
answer by *looking at where you are standing* is the thing a flashcard app cannot do.

**There is no failure state.** A wrong answer costs a coin and brings the character back
later. Nothing can be lost. This is homework a parent is nagging a child to do; if losing
is possible, the lesson learned is "I am bad at Chinese", which is much harder to undo
than any vocabulary gap.

**Difficulty adapts, silently.** Answer choices go 2 → 3 → 4 and distractors shift from
easy (九 against 五) to genuinely confusable (十 against 千) as mastery rises. There is no
setting, no label, and no comparison between children anywhere in the game.

Open the **Learning engine** panel under the game to watch all of it live. It is
instrumentation for adults; a player never sees it.

## Content and copyright

美洲華語 is a copyrighted curriculum. Individual characters and 生字 lists are not
copyrightable, several of the 課文 are public-domain folk rhymes, and the use here is
non-commercial and for students whose school already owns the books. The site is
unlisted and `noindex`. See DESIGN.md §6 — including the one action worth taking, which
is telling the school.

## Deploying

Free, and keeps the repository private:

1. Push to a **private** GitHub repo.
2. Cloudflare Pages → Create → connect the repo.
3. Build command `npm run build`, output directory `dist`.

GitHub Pages is not used: its free tier requires a public repository.

## Still open

- The 生字 lists and 部首 come from the source PDFs and want a teacher's confirmation.
  Lesson 2 is the known question — the radical table lists 百/千, the 教學指引's 生字 line
  does not. The game uses 110.
- 美洲華語 ships a CD, and every lesson's first objective is 跟著ＣＤ唱課文. Those are songs
  the children already sing. If the school has that audio it beats the generated clips
  outright — and swapping it in is replacing files under `content/audio/`.
- Chapter 1 runs about 20–25 minutes. The design targets ~60 per chapter; chapters 2–8
  should carry more story between encounters.
- No child has played it yet. Every design decision here is a hypothesis until one does.
