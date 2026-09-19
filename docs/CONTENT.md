# Authoring content

Everything the game says, shows and asks lives in `content/`. It is served as static
files, so **editing a file and reloading the page is enough** — no rebuild, no code.

```
content/
  characters.json     110 生字: 注音, 拼音, 部首, gloss, confusable set   (generated)
  lessons.json        16 lessons, 8 units, 詞語, 故事, 人文目標          (generated)
  chapters/ch01.json  one chapter: story, maps, people, questions        (hand-written)
  audio/              pre-generated mp3 + manifest.json                  (generated)
```

Generated files are rebuilt from the source PDFs with `npm run content`; your edits to
English glosses in `characters.json` are preserved across rebuilds. Chapter files are
written by hand — that is where the game actually lives.

---

## A chapter

```jsonc
{
  "chapter": 1, "unit": 1, "lessons": [1, 2],
  "title": "少了一頭驢", "titleEn": "The Missing Donkey",
  "virtue": { "zh": "細心", "en": "Look carefully before you panic." },

  // Everything this chapter is allowed to test. Must exist in characters.json.
  "shengzi": ["一", "二", "…"],

  // Things in the world that can be counted. Questions can read these, and
  // finishing an actor can change them. Saved with the player's progress.
  "counters": { "donkeys": 5, "squirrels": 4, "fruit": 10 },

  "templates": { /* see below */ },
  "scenes":    [ /* see below */ ]
}
```

## Scenes

A chapter is 2–3 scenes. Each is one map, and the player walks from `spawn` to `exit`.

```jsonc
{
  "id": "mountain",
  "name": "The mountain path",          // shown in the HUD
  "nameZh": "上山找老虎",                // the 課文 this scene comes from
  "open": "…",                          // one line of story on arrival
  "map": { /* below */ },
  "spawn": { "x": 2, "y": "path+1" },
  "exit":  { "x": 44, "to": "orchard" }, // omit on the last scene
  "finale": true,                        // last scene only: run finaleScript at the far end
  "actors": [ … ],
  "props":  [ … ]
}
```

### `y` can be relative

You rarely know which row the road is on, because it is a curve. Anywhere a `y` is
accepted you may write `"path"`, `"path-3"` or `"path+2"` instead of a number.

### Maps

The road is generated from a curve; you place what sits beside it.

```jsonc
"map": {
  "w": 46, "h": 20,                                  // in tiles, 32px each
  "path": { "base": 9.0, "amp": 2.0, "period": 7.0, "width": 2 },
  "treeXs": [3, 6, 9, 17],                           // trees on both verges at these columns
  "walls":  [{ "x": 14, "kind": "rock" }],           // a full column: the road is really blocked
  "features": [{ "kind": "bigtree", "x": 26, "y": "path-3" }]
}
```

**Keep `h` at 16 or more.** The viewport is 15 tiles tall; on a shorter map the camera
cannot scroll, and it cannot lift the player clear of the dialogue box during a question.

A `wall` blocks every row of its column except the road itself, which is held by whichever
actor has `"blocksWall": <x>` — so the gate opens only when that actor is satisfied, and
there is no way round over the grass.

Sprite kinds available: `tree`, `bigtree`, `fruittree`, `rock`, `fence`, `crate`,
`donkey`, `tiger`, `squirrel`, `keeper`, `pal`, `kid0`–`kid3`.

### Actors

```jsonc
{
  "id": "tiger", "sprite": "tiger", "name": "老虎", "nameEn": "the tiger",
  "x": 14, "y": "path",
  "blocksWall": 14,                 // holds the gap in the wall at x=14
  "intro":  "Nobody ever counts properly. Count for me and you may pass.",
  "reward": "The tiger pads off up the hill, satisfied at last.",
  "script": [ /* questions, below */ ],
  "onDone": {
    "unblock": true,                       // open the wall this actor was holding
    "moveTo": { "x": 14, "y": "path-4" },  // walk off
    "counters": { "donkeys": "+5" },       // "+5", "-2" or "7"
    "party": "小松鼠",                      // joins and follows you
    "coins": 3
  }
}
```

`"follows": true` instead of a script makes the actor a companion who trails behind you
from the start (小小).

### Props

Scenery whose count must match a counter — the squirrels you are asked to count. List one
position per possible unit; only the first *n* are shown.

```jsonc
{ "sprite": "squirrel", "counter": "squirrels",
  "at": [[26, "path-4"], [27, "path-5"], [25, "path-4"], [27, "path-3"], [26, "path-6"]] }
```

---

## Questions

A script is a list of steps. There are three kinds, and the difference is **where the
answer comes from**.

### `world` — the answer is on screen

The best kind, and the reason this is a game rather than a flashcard app. The child
answers by *looking at the place they are standing in*.

```jsonc
{ "kind": "world", "counter": "donkeys",
  "en": "How many donkeys are walking with you? Turn round and count them.",
  "parts": ["你", "有", null, "頭", "驢"] }
```

`parts` is the Chinese sentence; `null` is the blank. Only works for counts 1–10.

### `scheduled` — the answer comes from the mastery model

Lowest mastery first, with a known character folded back in every fourth question. The
child cannot tell a review question from a new one, and there is no screen labelled "quiz".

```jsonc
{ "kind": "scheduled", "template": "add" }
```

### `fixed` — written here

```jsonc
{ "kind": "fixed", "answer": "百",
  "en": "Ten crates, and ten fruit in every crate. What does that come to?",
  "parts": ["十", "個", "十", "是", "一", null] }
```

### Templates

Reusable question shapes. `{a}`/`{b}` are numbers in the English line; `{A}`/`{B}` are
the same numbers as characters in `parts`. `range` limits which answers the template can
produce — the scheduler only picks targets it can express.

```jsonc
"listen": { "en": "Listen. Which character did you hear?",
            "parts": [null], "speakAnswer": true },
"add":    { "en": "{a} donkeys here, and {b} more coming over the hill. How many is that?",
            "parts": ["{A}", "加", "{B}", "等", "於", null], "range": [2, 5] }
```

`listen` and `fixed` accept any character, so a script can always be satisfied.
`add` and `sub` compute their operands in `src/encounters.ts`; adding a template that
needs new arithmetic means adding a filler there. Everything else is data only.

---

## Rules the content must not break

These are design decisions, not preferences. See `DESIGN.md`.

- **No failure state.** A wrong answer costs a coin and re-queues the character. Never
  write a script or reward that can strand a child.
- **No visible difficulty, no comparison between children.** Difficulty adapts silently
  from mastery; do not add a label for it anywhere.
- **Phonetics stay hidden** behind the costed hint. Do not put 注音 or 拼音 in `parts`
  or in an English line.
- **English lines are short and spoken.** A 6-year-old cannot read a long sentence
  either. If a beat needs three sentences, it is the wrong beat.
- **Only test what the school teaches.** `shengzi` must be a subset of the lesson's real
  生字. 補充詞語 is exposure only — never an answer.

---

## After editing

```bash
npm run dev      # edit content, reload, see it
npm run audio    # generate speech for any new lines (needs: pip install edge-tts)
npm run build    # typecheck + production build
```

New English story lines fall back to the browser's voice until `npm run audio` is run;
the header chip tells you which is in use. Lines containing `{a}`/`{b}` are always spoken
by the browser, since they are generated per question.
