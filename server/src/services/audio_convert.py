from __future__ import annotations

import subprocess
from pathlib import Path


FFMPEG_CANDIDATES = [
    'ffmpeg',
    r'C:\ffmpeg\bin\ffmpeg.exe',
    r'D:\ffmpeg\bin\ffmpeg.exe',
]

# Modified by AI on 07/18/2026. Edit #1.
# ffprobe lives alongside ffmpeg in the same bin directory on most installs.
FFPROBE_CANDIDATES = [
    'ffprobe',
    r'C:\ffmpeg\bin\ffprobe.exe',
    r'D:\ffmpeg\bin\ffprobe.exe',
]

# Approximate encoding rate used by the client recorder (expo-av, 16kHz mono
# AAC ~64kbps). Used only as a size-based fallback duration estimate when
# ffprobe isn't available on the server.
ESTIMATED_CLIENT_AUDIO_BITRATE_BPS = 64_000


def probe_audio_duration_seconds(source_path: Path) -> float | None:
    """Best-effort audio duration in seconds. Tries ffprobe first; falls back
    to a size/bitrate estimate if ffprobe isn't installed. Returns None if
    duration cannot be determined at all (callers should decide how to treat
    that, e.g. allow through rather than block a valid recording)."""
    for candidate in FFPROBE_CANDIDATES:
        try:
            completed = subprocess.run(
                [
                    candidate,
                    '-v', 'error',
                    '-show_entries', 'format=duration',
                    '-of', 'default=noprint_wrappers=1:nokey=1',
                    str(source_path),
                ],
                capture_output=True,
                text=True,
                check=False,
            )
        except FileNotFoundError:
            continue
        output = (completed.stdout or '').strip()
        if completed.returncode == 0 and output:
            try:
                return float(output)
            except ValueError:
                pass

    try:
        size_bytes = source_path.stat().st_size
    except OSError:
        return None
    if size_bytes <= 0:
        return None
    return (size_bytes * 8) / ESTIMATED_CLIENT_AUDIO_BITRATE_BPS


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
