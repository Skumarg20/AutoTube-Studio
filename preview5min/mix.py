"""Score + sound design + narration for the 5-minute preview.  python mix.py   (run from this folder with the library venv)
Reads timeline.json + voices/*.wav, writes out/mix.wav (48 kHz stereo)."""
import sys, os, json
import numpy as np, soundfile as sf
LIB = r'C:\Users\sanjeev_6346\lemo-opuscar-src\lemo-opuscar-main'
sys.path.insert(0, os.path.join(LIB, 'core', 'audio'))
import sfx as X
from scipy.signal import butter, sosfilt
from scipy.ndimage import uniform_filter1d, maximum_filter1d
SR = 48000
TL = json.load(open('timeline.json', encoding='utf-8'))
N = int((TL['dur'] + 1) * SR)
rng = np.random.default_rng(3)
os.makedirs('out', exist_ok=True)

def t_(d): return np.arange(int(d * SR)) / SR
def lp(x, f): return sosfilt(butter(2, f, 'low', fs=SR, output='sos'), x)
def hp(x, f): return sosfilt(butter(2, f, 'high', fs=SR, output='sos'), x)
def bp(x, a, b): return sosfilt(butter(2, [a, b], 'band', fs=SR, output='sos'), x)
def mtof(m): return 440 * 2 ** ((m - 69) / 12)
def env(d, a=.005, r=.2):
    tt = t_(d); e = np.minimum(1, tt / max(a, 1e-4)) * np.exp(-tt / r); return e

# ---------------- instruments ----------------
def kick(v=1):
    d = .35; tt = t_(d); f = 45 + 110 * np.exp(-tt / .04); return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / .12) * v
def snare(v=1):
    d = .22; n = rng.standard_normal(int(d * SR)); return (bp(n, 1500, 7000) * np.exp(-t_(d) / .05) * .9 + np.sin(2 * np.pi * 190 * t_(d)) * np.exp(-t_(d) / .03) * .5) * v
def hat(v=1):
    d = .05; return hp(rng.standard_normal(int(d * SR)), 7000) * np.exp(-t_(d) / .012) * v
def pluck(m, d=.9, v=1):
    tt = t_(d); f = mtof(m); return (np.sin(2 * np.pi * f * tt) + .35 * np.sin(4 * np.pi * f * tt) + .1 * np.sin(6 * np.pi * f * tt)) * env(d, .002, .25) * v
def saw(m, d, v=1, cut=1800):
    tt = t_(d); f = mtof(m); x = 2 * ((f * tt) % 1) - 1; x += 2 * ((f * 1.004 * tt) % 1) - 1; return lp(x * .5, cut) * v
def pad(ms, d, v=1):
    tt = t_(d); x = sum(np.sin(2 * np.pi * mtof(m) * tt * (1 + dt)) for m in ms for dt in (-.002, .002)); e = np.minimum(1, tt / .8) * np.minimum(1, (d - tt) / .8)
    return lp(x, 2500) * e * v / len(ms)
def bass(m, d, v=1):
    tt = t_(d); return np.tanh(2 * np.sin(2 * np.pi * mtof(m) * tt)) * env(d, .005, d * .6) * v
def stab(m, d=.16, v=1): return saw(m, d, v, 2600) * env(d, .002, .08)
def piano(m, d=2.5, v=1):
    tt = t_(d); f = mtof(m); return sum(a * np.sin(2 * np.pi * f * k * tt) * np.exp(-tt / (1.2 / k)) for k, a in [(1, 1), (2, .4), (3, .2), (4, .1)]) * env(d, .003, 1.5) * v

music = np.zeros((N, 2))
def put(x, at, gain=1, pan=0.0):
    X.add(music, np.asarray(x, dtype=float), at, gain, pan)

BPM = 96; B = 60 / BPM
Dm, Bb, F, C, Gm, A = [50, 53, 57], [46, 50, 53], [41, 45, 48], [48, 52, 55], [43, 46, 50], [45, 49, 52]
D, Am_, G_, Bm = [50, 54, 57], [45, 48, 52], [43, 47, 50], [47, 50, 54]

def chapter_music(mood, t0, t1):
    bars = int(np.ceil((t1 - t0) / (4 * B))) + 1
    for b in range(bars):
        bt = t0 + b * 4 * B
        if bt >= t1: break
        if mood == 'tense':
            prog = [Dm, Dm, Bb, A][b % 4]
            put(pad([p + 12 for p in prog], 4 * B + .5, .55), bt)
            for k in range(4): put(kick(.9), bt + k * B) if k in (0, 2) else None
            for k in range(16): put(hat(.25 + .2 * (k % 2 == 0)), bt + k * B / 4, 1, .3)
            put(bass(prog[0] - 12, 4 * B, .5), bt)
        elif mood == 'curious':
            prog = [Dm, F, C, Gm][b % 4]
            put(pad([p + 12 for p in prog], 4 * B + .5, .35), bt)
            arp = [prog[0] + 24, prog[1] + 24, prog[2] + 24, prog[1] + 24]
            for k in range(8): put(pluck(arp[k % 4], .8, .35), bt + k * B / 2, 1, -.3 + .6 * (k % 2))
            for k in range(8): put(hat(.12), bt + k * B / 2 + B / 4, 1, .4)
            put(bass(prog[0] - 12, 2 * B, .35), bt); put(bass(prog[0] - 12, 2 * B, .3), bt + 2 * B)
        elif mood == 'suspense':
            prog = [Dm, Dm, Bb, A][b % 4]
            put(pad([p - 12 for p in prog] + [prog[0]], 4 * B + .5, .5), bt)
            for k in range(8): put(stab(prog[0] + (12 if k % 4 == 3 else 0), .14, .32), bt + k * B / 2)
            for k in range(4): put(X.click(1.6, .22), bt + k * B, 1, .5)   # clock tick
            put(kick(.6), bt)
        elif mood == 'march':
            prog = [Dm, Bb, F, A][b % 4]
            put(pad([p + 12 for p in prog], 4 * B + .5, .4), bt)
            for k in range(4):
                put(kick(1.0), bt + k * B)
                if k in (1, 3): put(snare(.55), bt + k * B)
            for k in range(8): put(snare(.14), bt + k * B / 2 + B / 4, 1, .2)
            line = [prog[0] - 12, prog[0] - 12, prog[1] - 12, prog[2] - 12]
            for k in range(4): put(bass(line[k], B * .9, .55), bt + k * B)
            for k in range(8): put(hat(.2), bt + k * B / 2, 1, .4)
        elif mood == 'drama':
            prog = [Dm, Bb, Gm, A][b % 4]
            put(pad([p for p in prog] + [prog[0] + 12], 4 * B + .5, .5), bt)
            put(piano(prog[0] - 12, 4 * B, .5), bt); put(piano(prog[2], 2 * B, .25), bt + 2 * B)
            put(lp(rng.standard_normal(int(1.2 * SR)), 120) * np.exp(-t_(1.2) / .5) * .6, bt)   # timpani-ish rumble
        elif mood in ('rise', 'outro'):
            prog = [D, A, Bm, G_][b % 4]
            put(pad([p + 12 for p in prog], 4 * B + .5, .45), bt)
            arp = [prog[0] + 24, prog[1] + 24, prog[2] + 24, prog[0] + 36]
            for k in range(8): put(pluck(arp[k % 4], .7, .3 if mood == 'rise' else .22), bt + k * B / 2, 1, -.3 + .6 * (k % 2))
            if mood == 'rise':
                for k in range(4): put(kick(.8), bt + k * B)
                for k in (1, 3): put(snare(.35), bt + k * B)
            put(bass(prog[0] - 12, 4 * B, .4), bt)

for c in TL['chapters']:
    chapter_music(c['mood'], c['t0'], c['t1'] + .4)
# final held chord
put(pad([62, 66, 69, 74], 4.5, .6), TL['dur'] - 4.5)

# chapter fades: short dip at each chapter boundary so moods don't smear
gate = np.ones(N)
for c in TL['chapters'][1:]:
    a = int((c['t0'] - .25) * SR); b = int((c['t0'] + .05) * SR); gate[a:b] = np.linspace(1, 0, b - a); gate[b:b + int(.1 * SR)] = np.linspace(0, 1, int(.1 * SR))
if TL.get('quiet'):   # the silent beat
    q0, q1 = TL['quiet']; a, b = int(q0 * SR), int(q1 * SR); gate[a - int(.3 * SR):a] = np.minimum(gate[a - int(.3 * SR):a], np.linspace(1, 0, int(.3 * SR))); gate[a:b] = 0; gate[b:b + int(.4 * SR)] = np.linspace(0, 1, int(.4 * SR))
music *= gate[:, None]

# ---------------- voice ----------------
voice = np.zeros(N)
for v in TL['voice']:
    x, sr = sf.read(os.path.join('voices', v['id'] + '.wav'), dtype='float32')
    if x.ndim > 1: x = x.mean(1)
    if sr != SR: x = np.interp(np.arange(int(len(x) * SR / sr)) * sr / SR, np.arange(len(x)), x)
    a = int(v['at'] * SR); e = min(N, a + len(x)); voice[a:e] += x[:e - a]
voice = voice / (np.abs(voice).max() or 1) * .9
# gentle presence EQ + compression
voice = voice + .25 * hp(voice, 2500)
voice = X.limit(voice, .9)

# ducking: music -11 dB under narration
ev = uniform_filter1d(maximum_filter1d(np.abs(voice), int(.08 * SR)), int(.15 * SR))
duck = np.where(ev > .02, 10 ** (-11 / 20), 1.0); duck = uniform_filter1d(duck, int(.25 * SR))
music *= duck[:, None]

# ---------------- sound effects ----------------
fx = np.zeros((N, 2))
def fxadd(x, at, g=1, pan=0.0): X.add(fx, np.asarray(x, dtype=float), at, g, pan)
def riser(d=1.2):
    tt = t_(d); f = 200 + 1600 * (tt / d) ** 2; s = np.sin(2 * np.pi * np.cumsum(f) / SR) * .3 + bp(rng.standard_normal(len(tt)), 2000, 8000) * .6
    return s * (tt / d) ** 2
def typer(d=.9): out = np.zeros(int(d * SR)); [out.__setitem__(slice(int(k / 14 * SR), int(k / 14 * SR) + len(c)), out[int(k / 14 * SR):int(k / 14 * SR) + len(c)] + c) for k in range(int(d * 14)) for c in [X.click(1.2 + rng.random() * .4, .5)] if int(k / 14 * SR) + len(c) < len(out)]; return out
def projector(d=1.0): out = np.zeros(int(d * SR)); c = X.clack(1.4, .4); [out.__setitem__(slice(int(k / 24 * SR), int(k / 24 * SR) + len(c)), c) for k in range(int(d * 24)) if int(k / 24 * SR) + len(c) < len(out)]; return out * .5
def impact(): return X.thump(1.0, 48) * .9 + X.crash(.35)[:int(.9 * SR)] * .5 if False else np.concatenate([X.thump(1.0, 48)])
def boom():
    d = 1.6; tt = t_(d); f = 38 + 50 * np.exp(-tt / .15); return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / .45) + lp(rng.standard_normal(len(tt)), 300) * np.exp(-tt / .12) * .5
for e in TL['sfx']:
    k, t = e['k'], e['t']
    if k == 'none': continue
    if k == 'whoosh': fxadd(X.whoosh(.32, 1), t - .16, .28, rng.uniform(-.5, .5))
    elif k == 'whooshbig': fxadd(X.whoosh(.9, 1), t - .3, .45)
    elif k in ('impact',): fxadd(boom(), t, .7); fxadd(X.whoosh(.3, 1), t - .2, .25)
    elif k == 'hit': fxadd(boom()[:int(.6 * SR)], t, .55)
    elif k == 'pop': fxadd(X.pop(1), t, .35)
    elif k == 'stamp': fxadd(X.thump(1, 110), t + .05, .5); fxadd(X.clack(.7, 1), t + .05, .35)
    elif k == 'type': fxadd(typer(1.0), t + .15, .35)
    elif k == 'pin': fxadd(X.click(.8, 1), t + .05, .45); fxadd(X.whoosh(.25, 1), t - .1, .2)
    elif k == 'beep': fxadd(X.quindar(1, 1900), t, .18)
    elif k == 'alarm': [fxadd(X.quindar(1, 880 if j % 2 else 660), t + j * .28, .25) for j in range(4)]
    elif k == 'riser': fxadd(riser(1.4), t - 1.4, .4); fxadd(boom()[:int(.8 * SR)], t, .4)
    elif k == 'projector': fxadd(projector(1.4), t, .35)
    elif k == 'prison': fxadd(X.clack(.5, 1), t + .1, .6); fxadd(boom()[:int(.5 * SR)], t + .1, .4)
    elif k == 'ding': fxadd(X.ding(1), t + 1.6, .35)
    elif k == 'sting':
        st = e.get('style')
        fxadd(riser(.9), t - .9, .3); fxadd(boom(), t, .65)
        if st == 'map': [fxadd(X.quindar(1, 1500), t + .2 + j * .18, .15) for j in range(3)]
        if st == 'reel': fxadd(projector(2.0), t, .3)
        if st == 'board': fxadd(X.thump(1, 110), t + 1.0, .5)
        if st == 'light': fxadd(X.click(1.0, 1), t + .3, .4)

# room tone/hiss in reel chapter
for c in TL['chapters']:
    if c['style'] == 'reel':
        a, b = int(c['t0'] * SR), int(c['t1'] * SR); h = hp(rng.standard_normal(b - a), 3000) * .012; fx[a:b, 0] += h; fx[a:b, 1] += h

music = music / (np.abs(music).max() or 1) * .55
mix = music * .55 + fx * .9 + voice[:, None] * 1.0
for ch in range(2): mix[:, ch] = X.limit(mix[:, ch], .92)
fl = int(.5 * SR); mix[:fl] *= np.linspace(0, 1, fl)[:, None]; mix[-fl:] *= np.linspace(1, 0, fl)[:, None]
sf.write('out/mix.wav', mix.astype(np.float32), SR, subtype='PCM_24')
print('mix written', round(N / SR, 1), 's')
