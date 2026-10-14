"""
claude-draws: a film score composed note by note in code, played by REAL recorded instruments.

    python3 make_score.py cues.json -o score.wav
    python3 make_score.py cues.json -o score.wav --samples /path/to/VSCO-2-CE

What this file does
  - reads a simple cue list (when each part of the story starts, its mood and key)
  - COMPOSES a first draft: a theme, chords, accompaniment and orchestration for each cue
    (every note's pitch, timing and loudness is decided here, in code)
  - PLAYS it with a free orchestra sample library: VSCO 2 Community Edition by Versilian
    Studios (CC0 / public domain): piano, strings, harp, flute, oboe, clarinet, horn,
    glockenspiel, timpani, cymbals
  - adds a hall reverb, MEASURES the mix (is the melody on top? anything too loud?) and
    prints warnings, then writes a loudness-matched WAV (-14 LUFS by default)

The cue list is only a starting point. For a real piece, ask Claude to write the notes for
YOUR story beat by beat in compose() (see references/film-score-in-code.md). The machinery
below (sample player, reverb, measuring) stays the same.

Get the instruments (free, ~500 MB):
  git clone https://github.com/sgossner/VSCO-2-CE.git ~/music-samples/VSCO-2-CE
  (or download from https://versilian-studios.com/vsco-community/)
Needs: Python 3 with numpy and scipy   (pip install numpy scipy)
Credit (asked for, not required): "Samples: VSCO 2 CE by Versilian Studios".

cues.json example:
  {
    "length": 24,
    "tempo": 76,
    "cues": [
      {"at": 0.0,  "mood": "gentle",  "key": "D major"},
      {"at": 3.0,  "mood": "storm",   "key": "B minor"},
      {"at": 9.0,  "mood": "hopeful", "key": "D major"},
      {"at": 15.0, "mood": "lift"},
      {"at": 16.5, "mood": "big",     "key": "D major"},
      {"at": 22.0, "mood": "ending",  "key": "D major"}
    ],
    "hits": [{"at": 6.1, "type": "thunder"}, {"at": 15.0, "type": "swell"}]
  }
moods: gentle, sneaky, playful, storm, tense, hopeful, big, lift, ending
hits:  thunder (timpani + bass drum), boom (timpani hit), swell (cymbal crescendo INTO "at"),
       crash (cymbal), roll (timpani roll INTO "at")
"""

import argparse, glob, json, os, re, sys, warnings

import numpy as np
from scipy.io import wavfile
from scipy.ndimage import maximum_filter1d
from scipy.signal import butter, fftconvolve, lfilter, sosfilt

warnings.filterwarnings("ignore")
SR = 44100
rng = np.random.default_rng(1)  # seeded: same cues -> same music, every time
LIB = None
NAMES = {"C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5, "F#": 6, "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11}


def M(n):
    """note name -> midi number ('F#5' -> 78); numbers pass through"""
    if not isinstance(n, str):
        return int(n)
    m = re.match(r"([A-G][#b]?)(-?\d)", n)
    return NAMES[m.group(1)] + 12 * (int(m.group(2)) + 1)


# ====================================================================================
# 1. the sample player
# ====================================================================================
class Inst:
    """One instrument: finds its samples by note name in the file names, picks the nearest
    recorded note (and loudness layer), and re-pitches it to the note we want."""

    def __init__(self, name, folder, pat, rel=0.4, pan=0.0, send=0.3, loopable=False, mapping=None):
        self.name, self.rel, self.pan, self.send, self.loopable = name, rel, pan, send, loopable
        self.gain, self.cache, self.zones = 1.0, {}, []
        for p in sorted(glob.glob(os.path.join(LIB, folder, "*.wav"))):
            f = os.path.basename(p)
            if mapping:
                mm = re.search(r"dyn(\d)_rr\d_(\d+)", f)
                if not mm or int(mm.group(2)) not in mapping:
                    continue
                midi, layer = mapping[int(mm.group(2))], int(mm.group(1))
            else:
                mm = re.search(pat, f)
                if not mm:
                    continue
                midi = M(mm.group(1))
                lv = re.search(r"_v(\d)", f)
                layer = int(lv.group(1)) if lv else 1
            self.zones.append((midi, layer, p))
        self.layers = sorted(set(z[1] for z in self.zones))

    def load(self, p):
        if p not in self.cache:
            sr, x = wavfile.read(p)
            big = np.max(np.abs(x)) if len(x) else 1
            x = x.astype(np.float32)
            if big > 2:  # integer wav -> -1..1
                x /= 2147483648.0 if big > 70000 else 32768.0
            if x.ndim == 1:
                x = np.stack([x, x], 1)
            x = x[:, :2]
            if sr != SR:  # resample to 44.1 kHz
                idx = np.arange(int(len(x) * SR / sr)) * (sr / SR)
                x = np.stack([np.interp(idx, np.arange(len(x)), x[:, c]) for c in range(2)], 1).astype(np.float32)
            thr = np.max(np.abs(x)) * 0.004  # trim the silence before the attack, keep 4 ms
            i = int(np.argmax(np.max(np.abs(x), 1) > thr))
            self.cache[p] = x[max(0, i - int(0.004 * SR)) :]
        return self.cache[p]

    def pick(self, midi, vel):
        want = self.layers[min(len(self.layers) - 1, int(vel * len(self.layers)))]
        return sorted(self.zones, key=lambda z: (abs(z[0] - midi) + (0 if z[1] == want else 2.5), rng.random()))[0]


I = {}


def build_lib():
    def piano_map():
        mp, f = {}, os.path.join(LIB, "Keys/Upright Piano/MappingChart.txt")
        if os.path.exists(f):
            for line in open(f):
                mm = re.match(r"(\d+)=(\d+)", line.strip())
                if mm:
                    mp[int(mm.group(1))] = int(mm.group(2))
        return mp

    spec = {
        "piano": ("Keys/Upright Piano", None, dict(rel=0.35, pan=0.0, send=0.25, mapping=piano_map())),
        "vln": ("Strings/Violin Section/susVib", r"susVib_([A-G]#?\d)", dict(rel=0.5, pan=-0.45, send=0.4, loopable=True)),
        "vlnTrem": ("Strings/Violin Section/Trem", r"Trem_([A-G]#?\d)", dict(rel=0.4, pan=-0.45, send=0.4, loopable=True)),
        "vlnPizz": ("Strings/Violin Section/Pizz", r"Pizz_([A-G]#?\d)", dict(rel=0.2, pan=-0.35, send=0.45)),
        "vla": ("Strings/Viola Section/susvib", r"susvib_([A-G]#?\d)", dict(rel=0.5, pan=0.15, send=0.4, loopable=True)),
        "vc": ("Strings/Cello Section/susvib", r"susvib_([A-G]#?\d)", dict(rel=0.5, pan=0.35, send=0.35, loopable=True)),
        "vcTrem": ("Strings/Cello Section/trem", r"trem_([A-G]#?\d)", dict(rel=0.4, pan=0.35, send=0.35, loopable=True)),
        "cb": ("Strings/Solo Contrabass/SusVib", r"SusVib_([A-G]#?\d)", dict(rel=0.5, pan=0.45, send=0.3, loopable=True)),
        "harp": ("Strings/Harp", r"KSHarp_([A-G]#?\d)", dict(rel=1.5, pan=-0.3, send=0.45)),
        "fl": ("Woodwinds/Flute/expvib", r"expvib_([A-G]#?\d)", dict(rel=0.35, pan=-0.1, send=0.45, loopable=True)),
        "ob": ("Woodwinds/Oboe/Vib", r"Vib_([A-G]#?\d)", dict(rel=0.3, pan=0.05, send=0.4, loopable=True)),
        "cl": ("Woodwinds/Clarinet/susLong", r"susLong_([A-G]#?\d)", dict(rel=0.35, pan=0.1, send=0.4, loopable=True)),
        "hn": ("Brass/F Horn/sus", r"sus_([A-G]#?\d)", dict(rel=0.5, pan=0.3, send=0.5, loopable=True)),
        "glock": ("Percussion/Glock", r"medium_([A-G]#?\d)", dict(rel=2.0, pan=-0.15, send=0.5)),
    }
    for name, (folder, pat, kw) in spec.items():
        ins = Inst(name, folder, pat, **kw)
        if ins.zones:
            I[name] = ins
        else:
            print(f"  (no samples found for {name} in {folder}, skipping it)")
    if "piano" not in I or "vln" not in I:
        sys.exit("Could not find the VSCO 2 CE samples. Pass --samples /path/to/VSCO-2-CE (see the top of this file).")


# how loud each section sits after calibration (1.0 = melody level). Tune by measuring.
ROLE = {"piano": 1.1, "vln": 0.75, "vlnTrem": 0.8, "vlnPizz": 0.55, "vla": 0.42, "vc": 0.38, "vcTrem": 0.7, "cb": 0.33, "harp": 0.6, "fl": 1.0, "ob": 0.8, "cl": 1.0, "hn": 0.24, "glock": 0.6}


class Score:
    """A multitrack: one stereo bus per instrument (or named bus). Notes are added at times in seconds."""

    def __init__(self, sec):
        self.n, self.sec, self.dry = int(sec * SR), sec, {}
        self.melodic, self.cues = set(), []  # which buses carry a tune; cue windows (for report)

    def bus(self, name):
        if name not in self.dry:
            self.dry[name] = np.zeros((self.n, 2), np.float32)
        return self.dry[name]

    def note(self, inst, n, t0, dur, vel=0.7, gain=1.0, bus=None):
        if inst not in I:
            return
        ins, midi = I[inst], M(n)
        z = ins.pick(midi, vel)
        x = ins.load(z[2])
        ratio = 2 ** ((midi - z[0]) / 12)
        need = int((dur + ins.rel) * SR)
        if int(need * ratio) + 2 > len(x) and ins.loopable:
            # a long note: keep the attack, then cross-fade the sustained body onto itself
            b0, b1, xf = int(len(x) * 0.35), int(len(x) * 0.85), int(0.25 * SR)
            out = x.copy()
            while len(out) < int(need * ratio) + 2:
                seg, fade = x[b0:b1], np.linspace(0, 1, xf, dtype=np.float32)[:, None]
                out[-xf:] = out[-xf:] * (1 - fade) + seg[:xf] * fade
                out = np.concatenate([out, seg[xf:]])
            x = out
        idx = np.arange(min(need, int((len(x) - 1) / ratio)), dtype=np.float64) * ratio
        y = np.stack([np.interp(idx, np.arange(len(x)), x[:, c]) for c in range(2)], 1).astype(np.float32)
        on = int(dur * SR)
        if on < len(y):  # release
            y[on:] *= np.exp(-np.arange(len(y) - on) / (ins.rel * SR / 4.0))[:, None].astype(np.float32)
        amp = ins.gain * gain * (0.25 + 0.75 * vel) ** 1.4
        l, r = np.cos((ins.pan + 1) * np.pi / 4) * 1.41, np.sin((ins.pan + 1) * np.pi / 4) * 1.41
        y[:, 0] *= l
        y[:, 1] *= r
        # players are never perfectly on the grid: a few ms of human timing
        i0 = int(round((t0 - (0.035 if ins.loopable else 0.0) + rng.normal(0, 0.006)) * SR))
        b = self.bus(bus or inst)
        if i0 >= self.n:
            return
        if i0 < 0:
            y, i0 = y[-i0:], 0
        y = y[: self.n - i0]
        b[i0 : i0 + len(y)] += y * amp

    def chord(self, inst, notes, t0, dur, vel=0.6, roll=0.0, gain=1.0, bus=None):
        for k, n in enumerate(notes):
            self.note(inst, n, t0 + k * roll, dur - k * roll, vel * rng.uniform(0.92, 1.05), gain, bus)

    def line(self, inst, t0, beat, notes, vel=0.7, legato=1.05, gain=1.0, bus=None):
        """notes = [(name or None for a rest, length in beats), ...]"""
        self.melodic.add(bus or inst)
        t = t0
        for n, b in notes:
            if n is not None:
                self.note(inst, n, t, b * beat * legato, vel, gain, bus)
            t += b * beat
        return t

    def sample(self, path, t0, gain=1.0, shift=0.0, bus="perc"):
        p = os.path.join(LIB, path)
        if not os.path.exists(p):
            return
        sr, x = wavfile.read(p)
        x = x.astype(np.float32)
        x /= 2147483648.0 if np.max(np.abs(x)) > 70000 else 32768.0
        if x.ndim == 1:
            x = np.stack([x, x], 1)
        ratio = (sr / SR) * 2 ** (shift / 12)
        idx = np.arange(int((len(x) - 1) / ratio)) * ratio
        x = np.stack([np.interp(idx, np.arange(len(x)), x[:, c]) for c in range(2)], 1).astype(np.float32)
        i0, b = int(t0 * SR), self.bus(bus)
        if i0 >= self.n:
            return
        if i0 < 0:
            x, i0 = x[-i0:], 0
        x = x[: self.n - i0]
        b[i0 : i0 + len(x)] += x * gain

    def automate(self, bus, pts):
        """piecewise-linear gain curve [(t, g), ...] on one bus (fades, swells)"""
        if bus in self.dry:
            g = np.interp(np.arange(self.n) / SR, [p[0] for p in pts], [p[1] for p in pts]).astype(np.float32)
            self.dry[bus] *= g[:, None]


def calibrate():
    """Play one middle note of every instrument, measure it, and set its gain so they all
    start equally loud. ROLE then balances the orchestra. (Raw samples differ by 20 dB+.)"""
    for name, ins in I.items():
        mids = sorted(z[0] for z in ins.zones)
        ins.gain = 1.0
        tmp = Score(2.5)
        tmp.note(name, mids[len(mids) // 2], 0.05, 1.5, 0.7)
        y = tmp.dry[name][: int(1.6 * SR)]
        ins.gain = (10 ** (-20 / 20) / (np.sqrt(np.mean(y**2)) + 1e-9)) * ROLE.get(name, 0.5)


# ====================================================================================
# 2. harmony helpers: keys, scales, chords
# ====================================================================================
MAJOR, MINOR = [0, 2, 4, 5, 7, 9, 11], [0, 2, 3, 5, 7, 8, 10]


def parse_key(k):
    m = re.match(r"([A-G][#b]?)\s*(major|minor|maj|min|m)?", (k or "D major").strip())
    tonic = NAMES[m.group(1)]
    minor = (m.group(2) or "major").startswith("min") or m.group(2) == "m"
    return tonic, minor


def degree(key, d, octave=4):
    """scale degree (1 = tonic, 8 = tonic an octave up, 0 / negatives go down) -> midi"""
    tonic, minor = key
    sc = MINOR if minor else MAJOR
    i = d - 1
    return 12 * (octave + 1) + tonic + sc[i % 7] + 12 * (i // 7)


def triad(key, root_deg, octave=4):
    return [degree(key, root_deg, octave), degree(key, root_deg + 2, octave), degree(key, root_deg + 4, octave)]


def near(midi, lo, hi):
    """move a note by octaves into the range lo..hi"""
    while midi < lo:
        midi += 12
    while midi > hi:
        midi -= 12
    return midi


# Progressions as scale degrees of the chord roots (4 bars, one chord per bar)
PROG = {
    "major": [1, 5, 6, 4],  # I  V  vi IV : warm, open
    "minor": [1, 6, 4, 5],  # i  VI iv V  : the storm / sad
}
# The theme, in scale degrees + beats. Sung by different instruments in different cues.
THEME = [(3, 1), (5, 0.5), (6, 0.5), (5, 1), (3, 1), (2, 1.5), (1, 0.5), (2, 1), (-2, 1)]
ANSWER = [(3, 1), (5, 0.5), (8, 0.5), (7, 1), (6, 0.5), (5, 0.5), (6, 1.5), (5, 0.5), (4, 1), (3, 1), (2, 1), (3, 0.5), (4, 0.5), (5, 1), (2, 1), (1, 3)]


def melody(key, motif, octave=5):
    return [((degree(key, d, octave) if d is not None else None), b) for d, b in motif]


# ====================================================================================
# 3. the composer: one recipe per mood (this is where the music is written)
# ====================================================================================
def cue_gentle(S, key, t0, t1, beat):
    """solo piano, pedal down: rolling arpeggios, the theme's first phrase on top, harp shimmer"""
    bar, t, k = 4 * beat, t0, 0
    while t < t1 - 0.2:
        root = PROG["minor" if key[1] else "major"][k % 4]
        ch = triad(key, root, 3)
        arp = [ch[0] - 12, ch[0], ch[1], ch[2], ch[1] + 12, ch[2]]
        for i, n in enumerate(arp):
            if t + i * beat / 2 < t1:
                S.note("piano", n, t + i * beat / 2, min(bar, t1 - t) + 0.4 - i * beat / 2, 0.38)
        t, k = t + bar, k + 1
    S.line("piano", t0 + 0.05, beat, melody(key, THEME[:5]), vel=0.55, legato=1.5)
    for i, d in enumerate([1, 3, 5, 8, 9, 10, 12, 15]):
        S.note("harp", degree(key, d, 4), t0 + 0.9 + i * 0.07, 2.4, 0.28, gain=0.6)


def cue_sneaky(S, key, t0, t1, beat):
    """tiptoe comedy: pizzicato bass line + plucked chords, a clarinet sneaking the theme in short notes"""
    t, k = t0, 0
    while t < t1 - 0.1:
        root = PROG["minor"][k % 4] if key[1] else [1, 6, 4, 5][k % 4]
        ch = triad(key, root, 3)
        for i in range(8):  # eighth notes: bass on the beat, chord tones off the beat
            tt = t + i * beat / 2
            if tt >= t1:
                break
            if i % 2 == 0:
                S.note("vlnPizz", near(ch[0], 55, 66), tt, 0.25, 0.42 if i % 4 == 0 else 0.3, gain=0.6)
            else:
                S.note("vlnPizz", near(ch[1 + (i // 2) % 2], 60, 74), tt, 0.2, 0.26, gain=0.6)
        t, k = t + 4 * beat, k + 1
    # measured: at equal settings the short clarinet notes sat ~10 dB under the pizzicato, so gain 2.2
    S.line("cl", t0 + 2 * beat, beat, [(n, b * 0.5) if n else (None, b * 0.5) for n, b in melody(key, THEME, 4)] * 2, vel=0.6, legato=0.7, gain=2.2)


def cue_playful(S, key, t0, t1, beat):
    """light and bouncy: pizzicato strings, flute + glockenspiel tune in short notes"""
    cue_sneaky(S, key, t0, t1, beat)
    S.line("fl", t0 + 4 * beat, beat, melody(key, THEME, 5), vel=0.6, legato=0.7)
    for i, (n, b) in enumerate(melody(key, THEME[:4], 6)):
        S.note("glock", n, t0 + 4 * beat + i * beat, 1.5, 0.45)


def cue_storm(S, key, t0, t1, beat):
    """minor key: string tremolo, pizzicato raindrops, low strings + horns, clarinet sings the theme"""
    t, k = t0, 0
    while t < t1 - 0.1:
        root = PROG["minor"][k % 4]
        d = min(4 * beat, t1 - t) + 0.08
        ch = triad(key, root, 4)
        for n in ch[1:]:
            S.note("vlnTrem", n, t, d, 0.5)
        S.note("vcTrem", near(ch[0], 43, 57), t, d, 0.55)
        S.note("cb", near(ch[0], 28, 40), t, d, 0.6)
        S.chord("hn", [near(n, 50, 65) for n in ch], t, d, 0.45)
        t, k = t + 4 * beat, k + 1
    S.automate("vlnTrem", [(0, 0), (t0, 0.4), (min(t1, t0 + 3), 1.0), (t1, 1.0), (t1 + 0.3, 0), (S.sec, 0)])
    tt = t0 + 0.2
    drops = [degree(key, d, 5) for d in (1, 3, 4, 5, 7, 8)]
    while tt < t1:
        if rng.random() < 0.7:
            S.note("vlnPizz", drops[rng.integers(0, len(drops))], tt, 0.3, rng.uniform(0.3, 0.55))
        tt += rng.choice([0.125, 0.25, 0.1875]) * beat
    S.line("cl", t0 + 0.3, beat * 0.92, melody(key, THEME[:6], 4), vel=0.6, gain=1.3)


def cue_tense(S, key, t0, t1, beat):
    """suspense: low tremolo on one note, a slow rising line, timpani heartbeat"""
    S.note("vcTrem", degree(key, 1, 2), t0, t1 - t0, 0.5)
    S.note("cb", degree(key, 1, 1), t0, t1 - t0, 0.5)
    rise = [degree(key, d, 4) for d in (1, 2, 3, 4, 5, 6)]
    step = (t1 - t0) / len(rise)
    for i, n in enumerate(rise):
        S.note("vln", n, t0 + i * step, step * 1.05, 0.35 + 0.05 * i)
    tt = t0
    while tt < t1:
        S.sample("Percussion/Timpani/Timpani1_Hit_v3_rr1_Sum.wav", tt, 0.5, shift=-3, bus="timp")
        tt += 2 * beat


def cue_hopeful(S, key, t0, t1, beat):
    """major key opens up: strings + horns, harp and piano arpeggios, flute takes the theme, glockenspiel"""
    t, k = t0, 0
    while t < t1 - 0.1:
        root = PROG["major"][k % 4]
        d = min(2 * beat, t1 - t)
        ch = triad(key, root, 4)
        S.note("cb", near(ch[0], 28, 43), t, d + 0.05, 0.6)
        S.chord("vc", [near(ch[0], 38, 50), near(ch[2], 45, 57)], t, d + 0.05, 0.6)
        S.chord("vla", [near(ch[0], 55, 67), near(ch[1], 57, 69)], t, d + 0.05, 0.5)
        S.chord("vln", [near(ch[1], 62, 74), near(ch[2], 64, 76)], t, d + 0.05, 0.48)
        S.chord("hn", [near(ch[0], 50, 62), near(ch[1], 55, 67)], t, d, 0.42)
        arp = [ch[0] - 12, ch[2] - 12, ch[0], ch[1]]
        for i, n in enumerate(arp):
            S.note("harp", n, t + i * beat / 2, beat * 1.6, 0.45)
            S.note("piano", n + 12, t + i * beat / 2, beat * 0.9, 0.4)
        S.note("glock", near(ch[2], 79, 91), t, 2.0, 0.5)
        t, k = t + 2 * beat, k + 1
    S.line("fl", t0 + 0.02, beat, melody(key, THEME, 5), vel=0.72)


def cue_big(S, key, t0, t1, beat):
    """the full orchestra: the theme's answer in violins (+ octave) and flute, cellos soar underneath"""
    cue_hopeful_pads(S, key, t0, t1, beat, vel=0.75)
    mel = melody(key, ANSWER, 5)
    S.line("vln", t0, beat, mel, vel=0.78, gain=1.5)
    S.line("vln", t0, beat, [((n + 12) if n else None, b) for n, b in mel], vel=0.55, gain=0.8)
    S.line("fl", t0, beat, [((n + 12) if n else None, b) for n, b in mel], vel=0.6, gain=0.7)
    S.line("vc", t0, beat, [(degree(key, d, 3), b) for d, b in [(1, 1), (5, 1), (7, 1), (9, 1), (8, 1), (6, 1), (5, 2), (3, 1), (5, 1), (1, 3)]], vel=0.66, gain=1.7)


def cue_hopeful_pads(S, key, t0, t1, beat, vel=0.6):
    t, k = t0, 0
    while t < t1 - 0.1:
        root = PROG["major"][k % 4]
        d = min(2 * beat, t1 - t)
        ch = triad(key, root, 4)
        S.note("cb", near(ch[0], 28, 43), t, d + 0.05, vel)
        S.chord("vla", [near(ch[0], 55, 67), near(ch[1], 57, 69)], t, d + 0.05, vel - 0.1)
        S.chord("hn", [near(n, 50, 67) for n in ch], t, d, vel - 0.15)
        for i in range(int(d / (beat / 4))):
            S.note("harp", [ch[0], ch[1], ch[2], ch[1]][i % 4] + (12 if i % 8 >= 4 else 0), t + i * beat / 4, beat, 0.36)
        S.note("glock", near(ch[2], 79, 91), t, 2.5, 0.5)
        t, k = t + 2 * beat, k + 1


def cue_lift(S, key, t0, t1, beat, next_key=None):
    """the big film cadence into the next cue: bVI - bVII - I (e.g. Bb - C - D), cymbal swell, timpani"""
    nk = next_key or key
    tonic = 12 * 3 + nk[0]
    half = (t1 - t0) / 2
    for i, off in enumerate([8, 10]):  # bVI, bVII (semitones above the tonic)
        r = tonic + off
        S.note("cb", r - 12, t0 + i * half, half, 0.8)
        S.chord("vc", [r, r + 7], t0 + i * half, half, 0.8)
        S.chord("vln", [r + 16, r + 19, r + 24], t0 + i * half, half, 0.75)
        S.chord("hn", [r + 7, r + 12, r + 16], t0 + i * half, half, 0.75)
    run = [tonic + 24 + s for s in (-4, -2, 0, 2, 4, 5, 7, 9)]
    for i, n in enumerate(run):
        S.note("vln", n, t0 + i * (t1 - t0) / len(run), (t1 - t0) / len(run) * 1.1, 0.6)


def cue_ending(S, key, t0, t1, beat):
    """quiet: one last rolled piano chord, a harp note, everything lets go"""
    ch = triad(key, 1, 3)
    S.chord("piano", [ch[0], ch[2], ch[0] + 12, ch[1] + 12, ch[2] + 12, ch[0] + 24], t0, max(2.0, t1 - t0), 0.4, roll=0.06)
    S.note("harp", ch[0] + 24, t0 + 0.4, 3.0, 0.3)


RECIPES = {"gentle": cue_gentle, "sneaky": cue_sneaky, "playful": cue_playful, "storm": cue_storm, "tense": cue_tense, "hopeful": cue_hopeful, "big": cue_big, "lift": cue_lift, "ending": cue_ending}


def hit(S, h):
    t, kind = h["at"], h.get("type", "boom")
    if kind == "thunder":
        S.sample("Percussion/Timpani/Timpani1_Hit_v3_rr1_Sum.wav", t, 2.2, shift=-3, bus="timp")
        S.sample("Percussion/bassdrum_rub2_v1.wav", t, 0.6)
    elif kind == "boom":
        S.sample("Percussion/Timpani/Timpani1_Hit_v3_rr1_Sum.wav", t, 1.6, shift=-3, bus="timp")
    elif kind == "swell":  # starts ~2 s before "at" so it peaks on it
        S.sample("Percussion/susCymb1-cresc-Median_v1.wav", t - 2.0, 0.5)
    elif kind == "crash":
        S.sample("Percussion/cymbal-crash1_pp_rr1.wav", t, 0.6)
    elif kind == "roll":
        S.sample("Percussion/Timpani/Rolls/Timpani1_Roll_v5_rr1_Sum.wav", t - 1.2, 0.6, bus="timp")


def compose(cfg):
    S = Score(float(cfg["length"]))
    beat = 60.0 / float(cfg.get("tempo", 76))
    cues = sorted(cfg["cues"], key=lambda c: c["at"])
    key = parse_key(cues[0].get("key", "D major"))
    for i, c in enumerate(cues):
        t0 = c["at"]
        t1 = cues[i + 1]["at"] if i + 1 < len(cues) else S.sec
        key = parse_key(c["key"]) if "key" in c else key
        fn = RECIPES.get(c.get("mood", "gentle"))
        if fn is None:
            sys.exit(f"unknown mood '{c.get('mood')}'. Use one of: {', '.join(RECIPES)}")
        S.cues.append((t0, t1, c.get("mood", "gentle")))
        if fn is cue_lift:
            nxt = parse_key(cues[i + 1]["key"]) if i + 1 < len(cues) and "key" in cues[i + 1] else key
            fn(S, key, t0, t1, beat, nxt)
        else:
            fn(S, key, t0, t1, beat)
    for h in cfg.get("hits", []):
        hit(S, h)
    return S


# ====================================================================================
# 4. hall, mix, measure, save
# ====================================================================================
def hall_ir(sec=2.8, seed=7):
    """a concert-hall impulse response made from shaped noise + a few early reflections"""
    r = np.random.default_rng(seed)
    n = int(sec * SR)
    t = np.arange(n) / SR
    ir = np.zeros((n, 2), np.float32)
    for c in range(2):
        noise = r.normal(0, 1, n)
        lo = sosfilt(butter(2, 1200, "low", fs=SR, output="sos"), noise) * np.exp(-t / 0.62)
        hi = sosfilt(butter(2, 1200, "high", fs=SR, output="sos"), noise) * np.exp(-t / 0.33)
        tail = (lo + 0.6 * hi) * np.clip(t / 0.03, 0, 1)
        for d, a in [(0.011, 0.5), (0.019, 0.35), (0.027, 0.3), (0.041, 0.22), (0.053, 0.18)]:
            tail[int((d + 0.002 * c) * SR)] += a * 8
        ir[:, c] = tail / np.sqrt(np.sum(tail**2))
    return ir


def mix(S):
    ir = hall_ir()
    dry = np.zeros((S.n, 2), np.float32)
    wet_in = np.zeros((S.n, 2), np.float32)
    for name, b in S.dry.items():
        dry += b
        wet_in += b * (I[name].send if name in I else 0.4)
    wet = np.stack([fftconvolve(wet_in[:, c], ir[:, c])[: S.n] for c in range(2)], 1)
    out = dry * 0.85 + wet * 0.9
    return sosfilt(butter(2, 30, "high", fs=SR, output="sos"), out, axis=0)


def loudness(x):
    """integrated loudness, LUFS (K-weighting approximated, gated like EBU R128)"""
    y = sosfilt(butter(2, 38, "high", fs=SR, output="sos"), x, axis=0) + 0.58 * sosfilt(butter(2, 1500, "high", fs=SR, output="sos"), x, axis=0)
    blk, hop = int(0.4 * SR), int(0.1 * SR)
    ms = np.array([np.mean(np.sum(y[i : i + blk] ** 2, 1)) for i in range(0, max(1, len(y) - blk), hop)])
    L = -0.691 + 10 * np.log10(ms + 1e-12)
    keep = ms[L > -70]
    if not len(keep):
        return -70.0
    L1 = -0.691 + 10 * np.log10(np.mean(keep))
    keep = ms[(L > L1 - 10) & (L > -70)]
    return -0.691 + 10 * np.log10(np.mean(keep))


def limit(x, ceil_db=-1.5):
    ceil = 10 ** (ceil_db / 20)
    pk = maximum_filter1d(np.max(np.abs(x), 1), int(0.004 * SR) * 2 + 1)
    g = lfilter([0.03], [1, -0.97], np.minimum(1, ceil / (pk + 1e-9)))
    return x * np.minimum(g, ceil / (pk + 1e-9))[:, None]


def report(S):
    """MEASURE before trusting your ears: level of every section, then, cue by cue, is the
    tune on top of the accompaniment? (The most common mistake: the melody gets buried.)"""
    db = lambda v: 20 * np.log10(np.sqrt(np.mean(v**2)) + 1e-9)
    lv = {k: db(v) for k, v in S.dry.items()}
    print("section levels (dB RMS):", "  ".join(f"{k} {v:.0f}" for k, v in sorted(lv.items(), key=lambda kv: -kv[1])))
    ok = True
    for t0, t1, mood in S.cues:
        a, b = int(t0 * SR), int(t1 * SR)
        win = {k: db(v[a:b]) for k, v in S.dry.items() if b > a}
        mel = {k: v for k, v in win.items() if k in S.melodic and v > -60}
        acc = {k: v for k, v in win.items() if k not in S.melodic and k not in ("perc", "timp") and v > -60}
        if mel and acc:
            m, (ak, av) = max(mel.values()), max(acc.items(), key=lambda kv: kv[1])
            if m < av + 2:
                ok = False
                print(f"  WARNING {t0:.1f}-{t1:.1f}s ({mood}): the tune is {av - m:.0f} dB under '{ak}'. Raise the tune or lower {ak}.")
    if "glock" in lv and lv["glock"] < max(lv.values()) - 24:
        ok = False
        print("  WARNING: glockenspiel is almost silent (raise its ROLE or velocity).")
    if any(lv.get(k, -120) > max(lv.values()) - 3 for k in ("cb", "vc")):
        ok = False
        print("  WARNING: the low strings are among the loudest sections: muddy on phone speakers.")
    if ok:
        print("  balance check: the tune sits on top in every cue.")


def save(path, x, lufs=-14.0):
    assert np.all(np.isfinite(x)), "the mix has NaN/inf in it: a note or sample is broken"
    x = limit(x * 10 ** ((lufs - loudness(x)) / 20))
    f = int(0.01 * SR)
    x[:f] *= np.linspace(0, 1, f)[:, None]
    x[-int(0.4 * SR) :] *= np.linspace(1, 0, int(0.4 * SR))[:, None]
    wavfile.write(path, SR, x.astype(np.float32))
    pk = 20 * np.log10(np.max(np.abs(x)) + 1e-9)
    print(f"wrote {path}: {len(x) / SR:.1f} s, {loudness(x):.1f} LUFS, peak {pk:.1f} dBFS")


def main():
    global LIB
    ap = argparse.ArgumentParser(description="Compose a film score from a cue list and play it with VSCO 2 CE samples.")
    ap.add_argument("cues", help="cue list JSON (see the top of this file)")
    ap.add_argument("-o", "--out", default="score.wav")
    ap.add_argument("--samples", default=os.environ.get("VSCO_DIR", os.path.expanduser("~/music-samples/VSCO-2-CE")), help="folder of VSCO 2 CE")
    ap.add_argument("--lufs", type=float, default=-14.0, help="loudness target (-14 = Instagram/YouTube)")
    a = ap.parse_args()
    LIB = a.samples
    if not os.path.isdir(LIB):
        sys.exit(f"VSCO 2 CE not found at {LIB}.\nGet it: git clone https://github.com/sgossner/VSCO-2-CE.git {LIB}")
    cfg = json.load(open(a.cues))
    build_lib()
    calibrate()
    S = compose(cfg)
    report(S)
    save(a.out, mix(S), a.lufs)


if __name__ == "__main__":
    main()
