from __future__ import annotations

import subprocess
from pathlib import Path


FFMPEG_CANDIDATES = [
    'ffmpeg',
    r'C:\ffmpeg\bin\ffmpeg.exe',
    r'D:\ffmpeg\bin\ffmpeg.exe',
]


def convert_audio_to_mp3(source_path: Path, target_path: Path) -> Path:
    last_error: str | None = None
    for candidate in FFMPEG_CANDIDATES:
        try:
            completed = subprocess.run(
                [candidate, '-y', '-i', str(source_path), '-vn', '-ar', '44100', '-ac', '2', '-b:a', '128k', str(target_path)],
                capture_output=True,
                text=True,
                check=False,
            )
        except FileNotFoundError:
            continue
        if completed.returncode == 0 and target_path.exists():
            return target_path
        last_error = (completed.stderr or completed.stdout or '').strip()
    raise RuntimeError(last_error or 'ffmpeg not found for audio conversion')
