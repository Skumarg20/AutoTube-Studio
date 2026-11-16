"""Mix narration + a soft generated music bed.  python mix.py plan.json voices_dir out.wav
plan.json = {"dur": seconds, "voice": [{"id": "s01", "at": seconds}, ...], "seed": int}
"""
import sys, json, os
import numpy as np, soundfile as sf

plan = json.load(open(sys.argv[1], encoding='utf-8')); vdir, out = sys.argv[2], sys.argv[3]
SR = 48000; N = int((plan['dur'] + 0.5) * SR)
voice = np.zeros(N, np.float32)
for v in plan['voice']:
    p = os.path.join(vdir, v['id'] + '.wav')
    if not os.path.exists(p): continue
    x, sr = sf.read(p, dtype='float32')
    if x.ndim > 1: x = x.mean(1)
    if sr != SR: x = np.interp(np.arange(int(len(x) * SR / sr)) * sr / SR, np.arange(len(x)), x).astype(np.float32)
    a = int(v['at'] * SR); b = min(N, a + len(x)); voice[a:b] += x[:b - a]
pk = np.abs(voice).max() or 1; voice *= 0.89 / pk

# --- music bed: slow pad chords (D minor feel), gentle and documentary-like ---
rng = np.random.default_rng(plan.get('seed', 1))
prog = [[50, 57, 62, 65], [46, 53, 58, 62], [41, 48, 53, 57], [48, 55, 60, 64]]   # Dm Bb F C
bar = 6.0
music = np.zeros(N, np.float32); t = np.arange(int(bar * SR)) / SR
env = np.minimum(1, t / 1.8) * np.minimum(1, (bar - t) / 1.8)
k = 0
for start in np.arange(0, plan['dur'] + bar, bar):
    ch = prog[k % len(prog)]; k += 1
    seg = np.zeros(len(t), np.float32)
    for m in ch:
        f = 440 * 2 ** ((m - 69) / 12)
        for det in (-0.12, 0.12):
            ph = rng.random() * 6.28
            seg += (np.sin(2 * np.pi * f * (1 + det / 100) * t + ph) + 0.25 * np.sin(4 * np.pi * f * t + ph)) * 0.5
    # soft bass note
    fb = 440 * 2 ** ((ch[0] - 12 - 69) / 12); seg += 0.9 * np.sin(2 * np.pi * fb * t)
    seg *= env
    a = int(start * SR); b = min(N, a + len(seg))
    if a < N: music[a:b] += seg[:b - a]
# one-pole low-pass for warmth
alpha = 0.06; y = np.zeros_like(music); acc = 0.0
yy = np.empty_like(music)
from itertools import accumulate
# vectorised IIR via scipy if present
try:
    from scipy.signal import lfilter
    music = lfilter([alpha], [1, alpha - 1], music).astype(np.float32)
except Exception:
    for i in range(N): acc += alpha * (music[i] - acc); yy[i] = acc
    music = yy
music /= (np.abs(music).max() or 1)
# ducking: music sits at -20 dB, drops to -29 dB under the voice
envv = np.abs(voice); win = int(0.25 * SR)
try:
    from scipy.ndimage import maximum_filter1d, uniform_filter1d
    envv = uniform_filter1d(maximum_filter1d(envv, win), win)
except Exception:
    pass
duck = np.where(envv > 0.02, 10 ** (-29 / 20), 10 ** (-20 / 20)).astype(np.float32)
try:
    from scipy.ndimage import uniform_filter1d
    duck = uniform_filter1d(duck, int(0.4 * SR))
except Exception:
    pass
fade = np.ones(N, np.float32); fl = int(2 * SR); fade[:fl] = np.linspace(0, 1, fl); fade[-fl:] = np.linspace(1, 0, fl)
mix = voice + music * duck * fade
mix /= max(1, np.abs(mix).max() / 0.95)
sf.write(out, np.stack([mix, mix], 1), SR, subtype='PCM_16')
print('mix', out, round(N / SR, 1), 's')
