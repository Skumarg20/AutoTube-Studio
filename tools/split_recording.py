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

# Hindi / Hinglish scripts (Devanagari, or Roman Hinglish): a multilingual model in Hindi mode. It writes what it hears in
# Devanagari (English words too, e.g. "फोन"), so script and transcript are both turned into a rough Latin consonant
# skeleton ("phone" and "फोन" -> "fn") and matched on that.
alltext = ' '.join(L['text'] for L in lines)
HG = re.findall(r'\b(hai|hain|nahi|kya|mein|toh|aur|yeh|woh|kar|karo|hota|tum|aap|bhi|sirf|kyun|abhi|sab|jab|tab)\b', alltext.lower())
hindi = bool(re.search('[ऀ-ॿ]', alltext)) or len(HG) / max(1, len(alltext.split())) > .04
CONS = dict(zip('कखगघङचछजझञटठडढणतथदधनपफबभमयरलवशषसहक़ख़ग़ज़ड़ढ़फ़',
  ['k','kh','g','gh','n','ch','chh','j','jh','n','t','th','d','dh','n','t','th','d','dh','n','p','ph','b','bh','m','y','r','l','v','sh','sh','s','h','q','kh','g','z','r','rh','f']))
VOW = dict(zip('अआइईउऊऋएऐओऔऑ', ['a','aa','i','ii','u','uu','ri','e','ai','o','au','o']))
SIGN = dict(zip('ािीुूृेैोौॉ', ['aa','i','ii','u','uu','ri','e','ai','o','au','o']))
def deva2lat(w):
    w = __import__('unicodedata').normalize('NFC', w); out = ''
    for i, ch in enumerate(w):
        nx = w[i + 1] if i + 1 < len(w) else ''
        if ch in CONS: out += CONS[ch] + ('' if nx in SIGN or nx in '़्' else 'a')
        elif ch in VOW: out += VOW[ch]
        elif ch in SIGN: out += SIGN[ch]
        elif ch in 'ंँ': out += 'n'
        elif ch.isascii(): out += ch
    return out
def skel(w):
    w = deva2lat(w).lower() if re.search('[ऀ-ॿ]', w) else w.lower()
    w = re.sub(r'[^a-z0-9]', '', w)
    for a, b in (('ph', 'f'), ('kh', 'k'), ('gh', 'g'), ('chh', 'c'), ('ch', 'c'), ('jh', 'j'), ('th', 't'), ('dh', 'd'), ('bh', 'b'), ('sh', 's'), ('rh', 'r'), ('w', 'v'), ('z', 'j'), ('q', 'k'), ('x', 'ks'), ('c', 'c')):
        w = w.replace(a, b)
    s = w[:1] + re.sub(r'[aeiouy]', '', w[1:]) if w else ''
    return re.sub(r'(.)\1+', r'\1', s)
def tok(word): return skel(word) if hindi else re.sub(r'[^a-z0-9]', '', word.lower())

# 2. transcribe with word timestamps
cache = os.environ.get('HS_ASR_CACHE')   # testing only: reuse a saved transcript
if cache and os.path.exists(cache): heard = json.load(open(cache, encoding='utf-8'))
else:
    from faster_whisper import WhisperModel
    model = WhisperModel(os.environ.get('HS_ASR_MODEL', 'small' if hindi else 'small.en'), device='cpu', compute_type='int8')
    segs, _ = model.transcribe(tmp, language='hi' if hindi else 'en', word_timestamps=True, vad_filter=True)
    heard = [(w.word, w.start, w.end) for s in segs for w in (s.words or [])]
    if cache: json.dump(heard, open(cache, 'w', encoding='utf-8'), ensure_ascii=False)
rw = []   # recognised words: (norm, raw, start, end)
for word, ws, we in heard:
    n = tok(word)
    if n: rw.append((n, word.strip(), ws, we))
print('recognised words:', len(rw), '(Hindi mode)' if hindi else '')

# 3. align the script's words to the transcript
NUM = {'0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four', '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine'}
def norm_tokens(text): return [t for t in (tok(x) for x in text.split()) if t]
script, owner = [], []
for i, L in enumerate(lines):
    for t in norm_tokens(L['text']): script.append(t); owner.append(i)
hit = {}   # script index -> recognised index
if not hindi:
    sm = difflib.SequenceMatcher(a=script, b=[r[0] for r in rw], autojunk=False)
    for a, b, size in sm.get_matching_blocks():
        for k in range(size): hit[a + k] = b + k
else:
    # Hindi mode: the transcript only roughly matches the script (other spellings, English words heard as Hindi), so exact
    # matching finds too few, scattered words. Align the whole script to the whole transcript in order (edit-distance style),
    # scoring each word pair by how alike their skeletons are; keep pairs that are alike enough.
    n, m, GAP = len(script), len(rw), .55
    sim = lambda a, b: 1.0 if a == b else difflib.SequenceMatcher(None, a, b).ratio()
    D = np.zeros((n + 1, m + 1), dtype=np.float32); B = np.zeros((n + 1, m + 1), dtype=np.int8)
    D[1:, 0] = np.arange(1, n + 1) * GAP; B[1:, 0] = 1; D[0, 1:] = np.arange(1, m + 1) * GAP; B[0, 1:] = 2
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            d = D[i - 1, j - 1] + 1 - sim(script[i - 1], rw[j - 1][0]); u = D[i - 1, j] + GAP; l = D[i, j - 1] + GAP
            if d <= u and d <= l: D[i, j] = d; B[i, j] = 0
            elif u <= l: D[i, j] = u; B[i, j] = 1
            else: D[i, j] = l; B[i, j] = 2
    i, j = n, m
    while i > 0 and j > 0:
        if B[i, j] == 0:
            if sim(script[i - 1], rw[j - 1][0]) >= .5: hit[i - 1] = j - 1
            i -= 1; j -= 1
        elif B[i, j] == 1: i -= 1
        else: j -= 1
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

def snap_to_pauses(span):
    """Hindi mode matches only some words, so a line's first or last words can fall outside its matched span.
    Move each boundary between two matched lines to the nearest pause (>= 0.25 s quiet) around it."""
    fr = int(.02 * sr); R = np.sqrt(np.mean(audio[:len(audio) // fr * fr].reshape(-1, fr) ** 2, axis=1))
    quiet = R < max(1e-3, np.percentile(R, 90) * .08); gaps, i = [], 0
    while i < len(quiet):
        if quiet[i]:
            j = i
            while j < len(quiet) and quiet[j]: j += 1
            if (j - i) * .02 >= .25: gaps.append((i * .02, j * .02))
            i = j
        else: i += 1
    if span[0][2]:   # the first line starts after the silence before it
        g = [x for x in gaps if x[1] <= span[0][0] + .3]; span[0][0] = max(span[0][0] - 1.0, g[-1][1]) if g else 0.0
    for k in range(len(span) - 1):
        a, b = span[k], span[k + 1]
        if not a[2] or not b[2]: continue
        mid = (a[1] + b[0]) / 2
        # the pause between two lines is usually longer than a breath inside a line: prefer long pauses, then near ones
        cand = [x for x in gaps if x[0] > a[0] + .3 and x[1] < b[1] - .3 and abs((x[0] + x[1]) / 2 - mid) < 2.5]
        if cand:
            g = max(cand, key=lambda x: (x[1] - x[0]) - .25 * abs((x[0] + x[1]) / 2 - mid)); a[1], b[0] = g[0], g[1]
    if span[-1][2]:  # the last line runs to the last sound of the recording
        loud = np.where(~quiet)[0]
        if len(loud): span[-1][1] = max(span[-1][1], (loud[-1] + 1) * .02)
if hindi: snap_to_pauses(span)

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
    # Hindi mode: the transcript is in another script than the plan, so no word timings; subtitles are spread over the line
    words[L['id']] = [] if hindi else [[rw[r][1], round(rw[r][2] - a0, 3), round(rw[r][3] - a0, 3)] for r in sorted(set(ris))]
json.dump(dur, open(os.path.join(out, 'dur.json'), 'w'), indent=1)
json.dump(words, open(os.path.join(out, 'words.json'), 'w', encoding='utf-8'), ensure_ascii=False)
for i, L in enumerate(lines): print('  %s %6.2f - %6.2f s  (%d words heard)' % (L['id'], span[i][0], span[i][1], len(span[i][2])))
matched = sum(1 for x in span if x[2])
print(f'lines matched: {matched}/{len(lines)}; total {sum(dur.values()):.1f} s')
try: os.remove(tmp)
except OSError: pass
