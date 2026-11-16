"""Split one narration recording into the plan's lines, so a real human voice can replace TTS.
python split_recording.py <recording (wav/mp3/m4a/...)> <lines.json> <out_dir>
lines.json = [{"id": "l001", "text": "..."}]; writes out_dir/<id>.wav, dur.json and words.json (word timings relative to each line),
the same layout tts.py + asr_check.py produce, so the rest of the pipeline doesn't change.
The reader may stumble, repeat or skip words: lines are matched to the transcript with sequence alignment."""
import sys, os, json, re, subprocess, tempfile, difflib
import numpy as np, soundfile as sf

rec, lines_path, out = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(out, exist_ok=True)
lines = json.load(open(lines_path, encoding='utf-8'))

# 1. decode anything ffmpeg understands to 24 kHz mono wav
tmp = os.path.join(tempfile.gettempdir(), 'hs_rec_%d.wav' % os.getpid())
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', rec, '-ac', '1', '-ar', '24000', tmp], check=True)
audio, sr = sf.read(tmp, dtype='float32')

# 2. transcribe with word timestamps
from faster_whisper import WhisperModel
model = WhisperModel(os.environ.get('HS_ASR_MODEL', 'small.en'), device='cpu', compute_type='int8')
segs, _ = model.transcribe(tmp, language='en', word_timestamps=True, vad_filter=True)
rw = []   # recognised words: (norm, raw, start, end)
for s in segs:
    for w in s.words or []:
        n = re.sub(r'[^a-z0-9]', '', w.word.lower())
        if n: rw.append((n, w.word.strip(), w.start, w.end))
print('recognised words:', len(rw))

# 3. align the script's words to the transcript
NUM = {'0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four', '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine'}
def norm_tokens(text): return [t for t in (re.sub(r'[^a-z0-9]', '', x.lower()) for x in text.split()) if t]
script, owner = [], []
for i, L in enumerate(lines):
    for t in norm_tokens(L['text']): script.append(t); owner.append(i)
sm = difflib.SequenceMatcher(a=script, b=[r[0] for r in rw], autojunk=False)
hit = {}   # script index -> recognised index
for a, b, size in sm.get_matching_blocks():
    for k in range(size): hit[a + k] = b + k
# per line: first and last matched recognised word
span = [None] * len(lines)
for si, ri in hit.items():
    i = owner[si]; s0, e0 = rw[ri][2], rw[ri][3]
    span[i] = [min(span[i][0], s0), max(span[i][1], e0), span[i][2] + [ri]] if span[i] else [s0, e0, [ri]]
# lines with no match: place them between neighbours
for i in range(len(lines)):
    if span[i] is None:
        prev_e = next((span[j][1] for j in range(i - 1, -1, -1) if span[j]), 0.0)
        next_s = next((span[j][0] for j in range(i + 1, len(lines)) if span[j]), len(audio) / sr)
        span[i] = [prev_e + .05, max(prev_e + .5, next_s - .05), []]
        print('WARNING: line', lines[i]['id'], 'not found in the recording; using the gap between its neighbours')

# 4. cut, with a little air around each line (never overlapping the next line)
dur, words = {}, {}
for i, L in enumerate(lines):
    s, e, ris = span[i]
    nxt = span[i + 1][0] if i + 1 < len(lines) else len(audio) / sr
    a0 = max(0.0, s - .08); a1 = min(len(audio) / sr, e + .18, nxt - .02 if nxt - .02 > e else e + .05)
    seg = audio[int(a0 * sr):int(a1 * sr)].copy()
    f = int(.01 * sr)
    if len(seg) > 2 * f: seg[:f] *= np.linspace(0, 1, f); seg[-f:] *= np.linspace(1, 0, f)
    sf.write(os.path.join(out, L['id'] + '.wav'), seg, sr)
    dur[L['id']] = round(len(seg) / sr, 3)
    words[L['id']] = [[rw[r][1], round(rw[r][2] - a0, 3), round(rw[r][3] - a0, 3)] for r in sorted(set(ris))]
json.dump(dur, open(os.path.join(out, 'dur.json'), 'w'), indent=1)
json.dump(words, open(os.path.join(out, 'words.json'), 'w', encoding='utf-8'), ensure_ascii=False)
matched = sum(1 for x in span if x[2])
print(f'lines matched: {matched}/{len(lines)}; total {sum(dur.values()):.1f} s')
try: os.remove(tmp)
except OSError: pass
