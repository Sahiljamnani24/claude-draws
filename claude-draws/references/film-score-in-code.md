# A film score composed in code, played by real instruments

Synth-only music made in code sounds "generated". What works: Claude writes every note (melody,
harmony, orchestration, timing, loudness) in Python, and a sample library of **real recorded
players** performs them. The sounds are recordings; the music is composed in code.

## Setup

- Instruments: **VSCO 2 Community Edition** by Versilian Studios, CC0 / public domain, free:
  `git clone https://github.com/sgossner/VSCO-2-CE.git ~/music-samples/VSCO-2-CE`
  (or https://versilian-studios.com/vsco-community/). Credit is asked for, not required:
  "Samples: VSCO 2 CE by Versilian Studios".
- Python 3 with `numpy` and `scipy` (`pip install numpy scipy`).
- `make_score.py` finds the samples in `~/music-samples/VSCO-2-CE`, or `--samples PATH`, or the
  `VSCO_DIR` environment variable.

## Method

1. **Score the picture, beat by beat.** Write down when each story beat starts (in seconds) and
   what it should feel like. Example (Goa monsoon, 24 s): solo piano while the ink draws → B minor
   storm (string tremolo, pizzicato raindrops, clarinet sings the theme, timpani into the thunder)
   → D major sunrise (flute theme, harp, glockenspiel) → a Bb-C-D lift on the scene change →
   full-orchestra sunset → a quiet ending.
2. **One theme, many costumes.** A short tune (8-10 notes) that comes back in different
   instruments, keys and moods ties the film together. `THEME` and `ANSWER` in make_score.py are
   written in scale degrees, so they work in any key, major or minor.
3. **Orchestrate by mood** (the recipes in make_score.py):
   - gentle: solo piano arpeggios with the pedal down, harp shimmer
   - sneaky / playful (comedy, creeping zombies): pizzicato strings, short clarinet notes, glockenspiel
   - storm / tense: minor key, string tremolo, low strings + horns, timpani
   - hopeful: major key opens up, strings + horns, harp and piano arpeggios, flute takes the theme
   - big: the theme in violins (doubled an octave up) + flute, cellos soar underneath
   - lift: bVI - bVII - I (e.g. Bb - C - D), the classic film-score "rising" cadence
   - ending: one rolled piano chord, everything lets go
4. **Hit the picture.** Put hits on the exact frames: `{"at": 6.1, "type": "thunder"}`; a cymbal
   swell that peaks ON a cut (`swell` starts 2 s early).
5. **Make it human.** The sample player adds a few ms of timing spread, picks the right loudness
   layer of the recording for each note's velocity, and long notes loop their sustain smoothly.

## Measure, then fix (do not trust a first mix)

`make_score.py` calibrates every instrument to the same loudness first (raw samples differ by
20 dB or more), then balances sections with `ROLE`, then prints the level of every section and a
per-cue check: is the tune on top of the accompaniment? Fix every WARNING before you use it.
It writes the file at -14 LUFS (Instagram / YouTube level) with peaks under -1.5 dBFS.

What measuring caught in real builds:
- cellos and horns louder than the melody (muddy on phone speakers)
- the glockenspiel almost silent; storm strings too quiet
- in a comedy cue, the clarinet tune sat 10-17 dB under the pizzicato backing
- the melody sat in the same range as a voice-over (fix: write the melody to its own stem so the
  editor can drop it under speech, or move it an octave up)
- peaks too hot after adding percussion

## Writing your own notes

The cue recipes are a first draft. For a piece that fits the story exactly, write `compose()`
yourself with the same tools:

```python
S = Score(6.0)                       # 6 seconds
beat = 60 / 92                       # tempo
key = parse_key("E minor")
S.line("cl", 0.5, beat, [("E4", 0.5), ("G4", 0.5), ("B4", 1), (None, 0.5), ("A4", 1.5)], vel=0.6)
S.chord("vln", ["E4", "G4", "B4"], 2.0, 1.5, vel=0.5)
S.note("harp", degree(key, 8, 5), 3.0, 2.0, 0.4)
S.sample("Percussion/Timpani/Timpani1_Hit_v3_rr1_Sum.wav", 4.0, 1.2, shift=-3, bus="timp")
S.automate("vln", [(0, 0), (2.0, 1), (5.5, 1), (6.0, 0)])   # fade
```

Then `report(S)` and `save("score.wav", mix(S))`. Add the WAV to `index.html` with an `id`:
`<audio id="score" src="audio/score.wav" data-start="0" data-duration="6" data-track-index="1" data-volume="1"></audio>`

## Honest wording

Say "Claude composed it, note by note, in code, and it is played by recordings of real
instruments (VSCO 2 CE)". Do not say Claude "made the sounds" or that it is a live orchestra.
