from pathlib import Path
import sys
from faster_whisper import WhisperModel

MODEL_NAME = "tiny"
DEVICE = "cpu"
COMPUTE_TYPE = "int8"
LANGUAGE = None


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


def main():
    if len(sys.argv) < 2:
        print("Usage: python transcribe_file.py <audio-file>")
        raise SystemExit(2)

    audio_path = Path(sys.argv[1]).expanduser().resolve()
    if not audio_path.exists():
        print(f"File not found: {audio_path}")
        raise SystemExit(1)

    model = WhisperModel(MODEL_NAME, device=DEVICE, compute_type=COMPUTE_TYPE)
    transcribe_kwargs = {
        "vad_filter": True,
        "beam_size": 1,
    }
    if LANGUAGE:
        transcribe_kwargs["language"] = LANGUAGE

    segments, info = model.transcribe(str(audio_path), **transcribe_kwargs)

    texts = []
    for seg in segments:
        text = (seg.text or "").strip()
        if text:
            texts.append(text)

    print(f"MODEL={MODEL_NAME}")
    print(f"LANG={info.language}")
    print("TEXT_START")
    print(" ".join(texts).strip())
    print("TEXT_END")


if __name__ == "__main__":
    main()
