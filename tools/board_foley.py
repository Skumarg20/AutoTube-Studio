"""Board foley for library-theme videos: every stroke, tap and eraser pass in events.json gets its own sound.
The marker / tap / eraser synthesis is taken from the Lemo Opuscar whiteboard demo (styles/whiteboard/demo/mix.py, MIT),
so the sound matches the theme exactly.   python tools/board_foley.py <events.json> <out.wav>
"""
import sys, os, json
import numpy as np, soundfile as sf
LIB = os.environ.get('HS_LIB', os.path.join(os.path.expanduser('~'), 'lemo-opuscar-src', 'lemo-opuscar-main'))
sys.path.insert(0, LIB)
from core.audio.sfx import SR, bp, add

ev = json.load(open(sys.argv[1], encoding='utf-8')); E = ev['ev']; DUR = float(ev['dur'])
rng = np.random.default_rng(11)
fol = np.zeros((int((DUR + 1) * SR), 2), np.float32)
tt = lambda d: np.arange(int(d * SR)) / SR
def dec(d, tau): return np.exp(-tt(d) / tau)
def db(x): return 10 ** (x / 20)

_band = {}
def band(n, lo, hi):
    k = (lo, hi)
    if k not in _band: _band[k] = bp(rng.standard_normal(SR * 8), lo, hi, 2).astype(np.float32)
    b = _band[k]; i = int(rng.integers(0, len(b) - n - 1)); return b[i:i + n]
def marker(dur, length, kind, pen, z=1.):
    d = max(.03, min(dur, 7.5)); n = int(d * SR); u = np.linspace(0, 1, n)
    v = 1 - .8 * np.cos(2 * np.pi * u)
    if kind == 'dash': v = np.ones(n) * 1.2
    a = (v / 1.8) ** .8 * np.minimum(1, u * d / .006) * np.minimum(1, (1 - u) * d / .012)
    br = {'black': 1.0, 'orange': 1.12, 'blue': .92, 'red': 1.05, 'green': .97}.get(pen, 1.)
    hiss = band(n, 2200 * br, 7500 * br) * (.55 + .45 * v / 1.8)
    body = band(n, 500 * br, 1500 * br) * .45
    grain = (rng.random(n) < .004 * (1 + v)) * rng.standard_normal(n) * .8
    x = (hiss + body + bp(grain, 1500, 6000)) * a
    if kind != 'dash' and length > 140 and rng.random() < .28:
        s0 = rng.uniform(.15, .55) * d; sd = min(d - s0, rng.uniform(.06, .16))
        if sd > .03:
            m = int(sd * SR); ts = np.arange(m) / SR; f0 = rng.uniform(1500, 2600) * br
            f = f0 * (1 + .03 * np.sin(2 * np.pi * rng.uniform(7, 13) * ts) + .05 * rng.standard_normal() * ts / sd)
            sq = np.sin(2 * np.pi * np.cumsum(f) / SR) + .3 * np.sin(4 * np.pi * np.cumsum(f) / SR)
            sq *= np.sin(np.pi * ts / sd) ** 1.5 * .35
            i0 = int(s0 * SR); x[i0:i0 + m] += sq[:len(x) - i0]
    x[:int(.004 * SR)] += bp(rng.standard_normal(int(.004 * SR)), 2500, 6500) * np.linspace(1, 0, int(.004 * SR)) * 1.4
    return x * .32 * min(1.3, z ** .5)
def tap(z=1.):
    n = int(.03 * SR); x = bp(rng.standard_normal(n), 1800, 6000) * dec(.03, .004) * 1.2
    return x * .3 * min(1.3, z ** .5)
def eraser(d):
    n = int(d * SR); t = tt(d)
    base = bp(rng.standard_normal(n), 250, 2600) * .6 + bp(rng.standard_normal(n), 2500, 6000) * .15
    mod = .45 + .55 * np.abs(np.sin(np.pi * t / d * 7))
    a = np.minimum(1, t / .04) * np.minimum(1, (d - t) / .06)
    return base * mod * a * .5
def put(x, t, g=1., pan=0.):
    if t < 0 or t >= DUR: return
    add(fol, np.asarray(x, np.float32), t, g, pan)

for e in E:
    ty, t = e.get('type'), e.get('t', 0); pan = e.get('pan', 0)
    if ty in ('stroke', 'write', 'dash'): put(marker(e.get('dur', .1), e.get('len', 50), ty, e.get('pen')), t, .8 if ty == 'write' else 1., pan)
    elif ty == 'tap': put(tap(), t, 1., pan)
    elif ty == 'erase': put(eraser(e.get('dur', 1)), t, 1.1, .1)
pk = np.abs(fol).max() or 1
sf.write(sys.argv[2], (fol / max(pk, 1.0)).astype(np.float32), SR, subtype='PCM_24')
print(json.dumps({'ok': True, 'events': len(E)}))
