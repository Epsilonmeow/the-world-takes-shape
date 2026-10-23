"""Verify the complete 19.3s export, including seven local audio-sync windows."""
from pathlib import Path
import os
import hashlib
import json
import re
import subprocess
import wave
import numpy as np

root = Path(__file__).resolve().parent.parent
ffmpeg = os.environ.get('FFMPEG_PATH', 'ffmpeg')
movie = root / 'deliverables' / 'centuries-first-19p3-seconds.mp4'
decode = subprocess.run([str(ffmpeg), '-hide_banner', '-i', str(movie), '-f', 'null', '-'], capture_output=True)
log = decode.stderr.decode('utf-8', 'replace')
frames = re.findall(r'frame=\s*(\d+)', log)
duration_match = re.search(r'Duration: (\d+):(\d+):(\d+\.\d+)', log)
video_stream = next((line for line in log.splitlines() if 'Video: h264' in line), '')
audio_stream = next((line for line in log.splitlines() if 'Audio: aac' in line), '')
size_match = re.search(r'(\d{3,5})x(\d{3,5})', video_stream)
fps_match = re.search(r'([\d.]+) fps', video_stream)
rate_match = re.search(r'(\d+) Hz', audio_stream)
duration = sum(float(v) * scale for v, scale in zip(duration_match.groups(), [3600, 60, 1])) if duration_match else None
width, height = map(int, size_match.groups()) if size_match else (0, 0)
fps = float(fps_match.group(1)) if fps_match else 0
rate = int(rate_match.group(1)) if rate_match else 0
container = 'mov,mp4,m4a,3gp,3g2,mj2' in log
decoded = subprocess.run([str(ffmpeg), '-v', 'error', '-i', str(movie), '-map', '0:a:0', '-f', 'f32le', '-ar', '48000', '-ac', '2', 'pipe:1'], capture_output=True, check=True)
actual = np.frombuffer(decoded.stdout, '<f4').reshape(-1, 2)
with wave.open(str(root / 'assets' / 'centuries-19p3.wav'), 'rb') as wav:
    source = np.frombuffer(wav.readframes(wav.getnframes()), '<i2').reshape(-1, 2).astype(np.float32) / 32768
matches = []
for seconds in [.3, 3.3, 6.3, 9.3, 12.3, 16.95, 18.9]:
    start = round(seconds * 48000)
    reference = source[start:start + 4096].reshape(-1).astype(np.float64)
    scores = []
    for shift in range(-96, 97):
        sample = actual[start + shift:start + shift + 4096].reshape(-1).astype(np.float64)
        scores.append(float(np.dot(reference, sample) / np.sqrt(np.dot(reference, reference) * np.dot(sample, sample))))
    best = int(np.argmax(scores))
    matches.append({'at': seconds, 'offset_samples': best - 96, 'correlation': scores[best]})
frame_count = int(frames[-1]) if frames else 0
ok = (decode.returncode == 0 and container and frame_count == 1158 and duration == 19.3
      and (width, height) == (1920, 1080) and fps == 60 and rate == 48000
      and 'stereo' in audio_stream and len(source) == 926400
      and 926400 <= len(actual) <= 927424
      and all(abs(window['offset_samples']) <= 1 and window['correlation'] > .99 for window in matches))
report = {'complete_decode': decode.returncode == 0, 'mp4_container': container, 'video_stream': video_stream.strip(),
          'audio_stream': audio_stream.strip(), 'video_frames': frame_count, 'duration_seconds': duration,
          'resolution': [width, height], 'fps': fps, 'audio_rate': rate, 'channels': 2 if 'stereo' in audio_stream else None,
          'decoded_audio_samples': len(actual), 'source_audio_samples': len(source), 'alignment_windows': matches,
          'sha256': hashlib.sha256(movie.read_bytes()).hexdigest(), 'bytes': movie.stat().st_size, 'ok': bool(ok)}
(root / 'deliverables' / 'verify.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
(root / 'deliverables' / 'decode.log').write_text(log, encoding='utf-8')
print(json.dumps(report, indent=2))
if not ok:
    raise SystemExit(1)
