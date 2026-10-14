---
name: claude-draws
description: >
  Make a hand-drawn watercolour + ink animation where every frame is painted by code on a
  canvas (no images, no AI pictures, no stock footage), rendered to MP4 with HyperFrames, and
  optionally a film score composed note by note in code and played with real recorded orchestra
  samples (VSCO 2 CE). Use it when someone types /claude-draws followed by a scene ("a house on a
  beach with zombies in it"), or asks for a hand-drawn animation, watercolour animation, painted
  animation, Ghibli style / anime style background animation, a cartoon scene drawn with code,
  "draw with code", "animate with code", "paint it in code", "an animated scene of ...", an
  animated postcard or illustration that moves, or "make music in code" / a score composed in code.
---

# claude-draws

You turn one sentence ("a house on a beach with zombies in it") into a short animated film that
looks hand-painted: cream paper, ink lines that draw themselves, watercolour washes that spread in,
then gentle animation. Everything is drawn by code you write. Defaults: **1080x1920 (vertical),
25 fps, 6 seconds** unless the user asks for something else.

`<skill>` below means the folder this SKILL.md is in (usually `~/.claude/skills/claude-draws`).

## What you need (check first, say plainly what is missing)

- Node.js 18+ and HyperFrames (`npx hyperframes --version` downloads it on first use).
- ffmpeg (for contact sheets).
- Music only: Python 3 with `numpy` and `scipy`, and the free VSCO 2 CE samples
  (`git clone https://github.com/sgossner/VSCO-2-CE.git ~/music-samples/VSCO-2-CE`).
- A memory note: rendering opens a browser. On a 16 GB computer, or with other heavy apps open,
  always render with `--workers 1 --low-memory-mode`, never render 4K, and run one heavy job at a time.

## The workflow (this is what made the difference; do not skip steps)

### 1. Pick ONE scene and ONE look

Turn the request into a short plan and write it to `PLAN.md` in the project:

- **Subject + place + time of day/weather + mood.** Small and specific beats big and vague.
  ("a Goan beach house at dusk, four funny cartoon zombies shambling up the sand toward it")
- **Three beats** that fit the length. The house style opening is: ink lines draw themselves on
  blank paper → the paint spreads in under them → the scene comes alive. (For clips under ~3 s,
  start already painted: set `S.WASH = [-1, -0.5]` and `S.INK_FADE = [-1, -0.5]` in the scene.)
- **What "correct" looks like** in one line (e.g. "reads as house + beach + zombies on a phone in
  the first 3 seconds") and **how you will check it** (snapshots at named moments).

Fill gaps with sensible choices and state them. Ask a question only if the subject itself is unclear.

### 2. Study how professionals make this look BEFORE drawing

Read `references/watercolour-look.md` (background painting, layering, watercolour physics, ink).
For characters read `references/characters.md`. If you can search the web, also look up how
artists draw your specific subject (e.g. "zombie walk cycle animation", "how to paint moonlight on
water watercolour") and write 5-8 rules you will follow into `PLAN.md`. This step made the biggest
difference in quality: the first Goa draft without it looked flat and amateur.

### 3. Draw everything in code

```bash
npx hyperframes init my-film --example blank --resolution portrait --non-interactive
cd my-film
cp <skill>/templates/index.html .
mkdir -p js audio tools renders
cp <skill>/templates/js/*.js js/
cp <skill>/templates/tools/contact_sheet.sh tools/
```

- `js/engine.js`: the paint box. `E.paint` (watercolour wash), `E.finish` (pigment edges +
  granulation), `E.sketchLines` / `E.makeLine` / `E.drawLine` (ink that draws itself),
  `E.makePaper`, `E.smoothP`, `E.drawBird`. Read its header once.
- `js/scene.js`: an EXAMPLE scene (a Goan house on a beach at dusk). Keep its structure
  (`build` / `draw` / `drawInk`, layers back to front, multiplane camera), replace the content
  with your scene. Its header explains the pattern.
- `js/palms.js`: coconut palms that sway leaf by leaf. `js/figures.js`: cut-out characters
  (painted parts on a skeleton, walk + zombie-shamble gaits). `examples/zombies.js` shows a full
  cast built on it (costumes, faces, wake-up, paths).
- Set the length in three places in `index.html` (root `data-duration`, canvas `data-duration`,
  `DURATION`).

Hard rules (break one and the render flickers, changes between runs, or fails):

1. **No images, no video, no fonts, no AI pictures, no stock.** Every pixel is painted by code.
   Words on screen are written as pen strokes with `E.makeLine` so they write themselves in ink
   (see `LA` in `examples/zombies_lalala.js`), never a typeface.
2. **Seeded randomness only.** `E.seed("layer-name")` then `E.R()` / `E.rr()` while building.
   Inside `draw(g, t)` never call `E.R()`; use `E.hash(i, j)`. Never `Math.random()`, `Date`, timers.
3. **`render(t)` is a pure function of `t`.** The renderer asks for frames in any order.
4. Paint still things ONCE into layers in `build()`; per frame only move, sway and composite.
5. One paused GSAP timeline registered as `window.__timelines["main"]` (the template does this).
6. Every `<audio>` needs an `id`. Run `npx hyperframes lint` after each big change (0 errors).

### 4. Look at your own frames, list what is wrong, fix, repeat

Never judge your drawing from the code. Look at it:

```bash
npx hyperframes snapshot --at 0,1,2,3,4.5,5.9 --no-end --describe false -o .snap/r1
```

Open `.snap/r1/contact-sheet.jpg`, then zoom into faces, hands, joints and anything small (crop a
frame with ffmpeg and look at it full size). Write a numbered list of everything that looks wrong,
fix it, snapshot again with a new folder name. Do at least 2 rounds; stop only when the list is
empty or the user's time runs out. Check motion too: a strip of 8-16 consecutive frames of a moving
character. The full checklist and real examples of what this caught are in
`references/self-check-loop.md`.

### 5. Music (optional): compose a score in code, played by real instruments

Map the story beats to cues (time, mood, key) in `audio/cues.json`, then:

```bash
cp <skill>/templates/audio/make_score.py <skill>/templates/audio/cues.example.json audio/
python3 audio/make_score.py audio/cues.json -o audio/score.wav
```

It composes a first draft note by note, plays it with VSCO 2 CE recordings, adds a hall reverb,
**measures** the balance cue by cue and prints warnings, and writes -14 LUFS. Fix every warning.
For a real piece, write the notes for this story yourself in `compose()` (theme, harmony, who
plays what, when). Then add to `index.html`:
`<audio id="score" src="audio/score.wav" data-start="0" data-duration="6" data-track-index="1" data-volume="1"></audio>`.
Details, moods and the mistakes measuring caught: `references/film-score-in-code.md`.
Honest wording for the user: "Claude composed it note by note in code; the instrument sounds are
recordings of real players (VSCO 2 CE, public domain)."

### 6. Render, then look again

```bash
npx hyperframes render --workers 1 --low-memory-mode --fps 25 --quality looks -o renders/film_v1.mp4
sh tools/contact_sheet.sh renders/film_v1.mp4 renders/film_v1_sheet.jpg 6 3
```

Look at the sheet. Show the user the clip path, the sheet, and an honest list of what still looks
weak. When they ask for changes, change that one thing and render a new version number
(`_v2`); never overwrite a version they have seen.

## What to tell the user up front (keep it honest)

- Quality comes from rounds of look-and-fix, not from one prompt. Expect a first draft, then fixes.
- Characters are cut-out puppets (painted parts that rotate at the joints), not frame-by-frame
  hand animation. They read well at phone size; they will not move like a Ghibli film.
- The render itself is quick (seconds to a minute for a short clip); building the drawing is the work.

## Files in this skill

| File | What it is |
| --- | --- |
| `templates/index.html` | HyperFrames starter: paper, ink intro, wash reveal, seek-safe timeline |
| `templates/js/engine.js` | watercolour washes, ink lines, paper, seeded random, helpers |
| `templates/js/scene.js` | example scene (Goan beach house at dusk) and the scene pattern |
| `templates/js/palms.js` | coconut palms that sway leaf by leaf |
| `templates/js/figures.js` | cut-out character rig + walk / zombie shamble gaits |
| `templates/examples/zombies.js` | four cartoon zombies built on figures.js (the demo cast) |
| `templates/examples/zombies_lalala.js` | the same cast SINGING: mouths per syllable, choir sway, self-writing ink lettering, music notes |
| `templates/audio/make_score.py` | cue list → composed score with real samples → measured mix |
| `templates/audio/cues.example.json` | a 24 s cue list (gentle → storm → sunrise → lift → finale) |
| `templates/tools/contact_sheet.sh` | 6-frame contact sheet from a render |
| `references/watercolour-look.md` | how professionals paint this look, turned into code settings |
| `references/characters.md` | drawing characters that read at phone size |
| `references/self-check-loop.md` | the look-list-fix loop, checklist, real catches |
| `references/film-score-in-code.md` | composing in code, measuring, fixing the mix |
