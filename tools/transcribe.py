"""Transcribe a narration recording to plain text (for "voice first" videos, where the plan follows the recording).
python transcribe.py <recording> -> prints the transcript"""
import sys, os
from faster_whisper import WhisperModel
model = WhisperModel(os.environ.get('HS_ASR_MODEL', 'small.en'), device='cpu', compute_type='int8')
segs, _ = model.transcribe(sys.argv[1], language='en', vad_filter=True)
sys.stdout.reconfigure(encoding='utf-8')
print(' '.join(s.text.strip() for s in segs))
