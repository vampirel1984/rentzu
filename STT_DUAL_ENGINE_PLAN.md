# Rentzu Dual-Engine STT Plan: SenseVoice (Chinese) + Whisper-tiny (English)

> **Status:** Design / implementation spec. No code changed yet.
> **Author:** Research + design pass. Hand this to an implementer.
> **Goal:** At backend startup, preload **two** speech-to-text engines. Route each
> transcription request by language: **Chinese → SenseVoice-Small**, **English (or
> anything else / auto) → existing faster-whisper `tiny`**. The OpenAI extraction
> step (transcript → structured financial records) is **unchanged**.

---

## 1. Purpose & motivation

Rentzu turns a short voice note ("pay 400 rent for unit 2, repairs 150") into
structured financial records. Pipeline today:

```
client (expo-av, m4a/AAC 16kHz mono, ≤30s)
   → POST /voice/transcribe
   → faster-whisper "tiny" (local, CPU, int8)   ← STT
   → OpenAI Responses API gpt-4.1-mini           ← extraction (transcript → JSON)
   → DB insert
```

**Problem:** faster-whisper `tiny` is the *weakest* Whisper model and is poor on
**Chinese**. We want good Chinese support without sacrificing the (already fine)
English path or adding a GPU.

**Why SenseVoice-Small (Alibaba FunAudioLLM):**
- Non-autoregressive → very fast, CPU-friendly.
- Purpose-built for CJK; **best-in-class Chinese/Cantonese**.
- Languages: zh, yue (Cantonese), en, ja, ko.

**Why keep Whisper for English:** SenseVoice's advantage is Chinese. On English
it's only "good," while Whisper is genuinely strong on English. Our English
domain phrases are easy for either engine, so there's no reason to regress the
English path. Hence: **route by language, run both.**

---

## 2. Research summary (evidence behind the decision)

### 2.1 FunASR maintainer benchmark — Discussion #2947
Source: https://github.com/modelscope/FunASR/discussions/2947 (maintainer
LauraGPT; updated 2026-07-15 to correct earlier overclaims — adds credibility).
Dataset: **184 long-form Chinese meeting files, 192.3 min**, scored as **CER**
(character error rate; lower = better). **No English data in this benchmark.**

**CPU rows (this is Rentzu's reality — `WHISPER_DEVICE=cpu`):**

| Model | Device | Speed | CER (Chinese) |
|---|---|---|---|
| **SenseVoice-Small** | **CPU** | **17.2× realtime** | **7.81%** |
| Paraformer-Large | CPU | 15.6× | 10.18% |
| Fun-ASR-Nano | CPU | 3.6× | 8.06% |

**GPU Whisper rows (for context — Rentzu has no GPU):**

| Model | Device | Speed | CER (Chinese) |
|---|---|---|---|
| Whisper-large-v3-turbo | GPU | 46.1× | 21.71% |
| Whisper-large-v3 | GPU | 13.4× | 20.02% |

**Takeaways:**
- SenseVoice on **CPU** (7.81% CER) beats Whisper-large-v3 on **GPU** (20.02%) —
  ~2.6× fewer Chinese errors, no GPU needed.
- Rentzu currently runs Whisper **tiny**, which is far worse than large-v3 on
  Chinese, so the real-world Chinese gap is even bigger.
- 17.2× realtime on CPU → a 30s clip transcribes in ~1.7s. Fast enough.

### 2.2 English — the important caveat
- Benchmark #2947 has **zero English data**; do not infer English quality from it.
- SenseVoice-Small on English is decent (~4–5% WER on clean read speech) but
  **trails Whisper** on messy/accented/conversational English.
- Whisper is trained on a huge English corpus and is strong on English.
- Conclusion: the huge Chinese advantage **does not carry to English**; on English
  the two are roughly a wash and Whisper may edge ahead. → **Keep Whisper for English.**

### 2.3 Capability notes (from #2947 "Capability boundaries")
- SenseVoiceSmall supports zh, yue, en, ja, ko + utterance-level language,
  emotion, and audio-event tags (**tags must be stripped** before use).
- Diarization / hotwords / streaming depend on model + runtime path; base
  SenseVoiceSmall has **no built-in diarization** (we don't need it).
- FunASR toolkit is **MIT-licensed**; model weights follow their own model cards.
- Official smoke test: `pip install -U torch torchaudio funasr`.

### 2.4 Cost of adoption
- **Heavy dependency:** funasr pulls **torch + torchaudio** (~1–2 GB install).
  This is the main downside. (Alternative runtime = sherpa-onnx INT8 without
  torch; see §8 "Alternative B" — not chosen for v1 to keep code simple.)
- Migration blast radius is tiny: transcription is encapsulated behind one
  function; only the router/dispatch and a new service file are added.

---

## 3. Current architecture (facts the implementer needs)

All paths under `D:\apps\rentzu\`.

### 3.1 Startup — `server/src/main.py`
- FastAPI app uses a `lifespan` async context manager (lines ~18–21).
- **Currently it does NOT preload any STT model.** The Whisper model loads
  **lazily** on the first `/voice/transcribe` call via `_get_model()`. (The user's
  assumption that "the model starts at startup" is not yet true — this plan makes
  preloading explicit and adds the second engine.)
- `lifespan` body today:
  ```python
  @asynccontextmanager
  async def lifespan(app: FastAPI):
      Base.metadata.create_all(bind=engine)
      yield
  ```

### 3.2 Whisper service — `server/src/services/whisper_transcribe.py` (~110 lines)
- Public API: `transcribe_audio(audio_path: Path, language: str | None = None) -> str`
- Singleton model via `_get_model()` (module global `_model`, `_model_lock`).
- Env config: `WHISPER_MODEL_NAME` (default `"tiny"`), `WHISPER_DEVICE`
  (`"cpu"`), `WHISPER_COMPUTE_TYPE` (`"int8"`), `WHISPER_LANGUAGE`,
  `WHISPER_INITIAL_PROMPT`.
- Transcribe kwargs: `vad_filter=True`, `beam_size=1`; passes `language` and
  `initial_prompt` only when set.
- **Do not break this signature.** SenseVoice will mirror it.

### 3.3 Router — `server/src/routers/voice.py`
- Import (line 21): `from services.whisper_transcribe import transcribe_audio as whisper_transcribe_audio`
- `_transcribe_with_whisper(audio_path, language=None) -> str` (line ~143):
  thin wrapper w/ logging + `HTTPException` on failure. **This is the dispatch
  point to modify.**
- Endpoint `POST /voice/transcribe` (`voice_transcribe`, line ~248):
  - Saves upload to a temp file, suffix from original filename (m4a in prod).
  - Enforces 30s cap via `probe_audio_duration_seconds`.
  - Computes language (line ~299):
    ```python
    voice_language = (language
        or getattr(current_user.user, 'language_preference', None)
        or '').strip().lower() or None
    transcript = _transcribe_with_whisper(temp_path, language=voice_language)
    ```
  - Then `_extract_records_from_text(transcript)` → OpenAI (UNCHANGED).
- **Language values:** `'zh'` (Chinese) or `'en'` (English); may be `None` (auto).
  Driven by `User.language_preference` (default `'en'`) or an explicit form field.

### 3.4 Audio handling — `server/src/services/audio_convert.py`
- `probe_audio_duration_seconds(path)` — ffprobe with size/bitrate fallback.
- `convert_audio_to_mp3(source, target)` — ffmpeg to 44.1kHz stereo mp3.
- FFMPEG/FFPROBE candidate lists: `ffmpeg`/`ffprobe` on PATH, plus
  `C:\ffmpeg\bin\...` and `D:\ffmpeg\bin\...`.
- **We will add** `convert_audio_to_wav16k(source, target)` (16kHz mono WAV),
  because SenseVoice/FunASR wants 16kHz mono and may not decode m4a directly.

### 3.5 Language preference storage
- `models/user.py`: `language_preference` TEXT NOT NULL default `'en'`.
- `schemas/user.py`: `LanguagePreference` = `'en' | 'zh'`.
- `services/users.py::update_language_preference`, `routers/users.py`.

### 3.6 Dependencies — `D:\apps\rentzu\requirements.txt`
Current STT line: `faster-whisper>=1.0.3`. venv at `D:\apps\rentzu\.venv`.

---

## 4. Design

### 4.1 Routing rule
```
lang = normalized language ('zh' | 'en' | other | None)

if lang == 'zh'  (or 'yue' / 'zh-*')   → SenseVoice-Small
else                                    → faster-whisper "tiny"   (default)
```
- English, unknown, and auto (`None`) all go to Whisper (safe default, preserves
  current behavior for everything except Chinese).
- Optional env kill-switch `STT_SENSEVOICE_ENABLED=1` (default on). If off, or if
  SenseVoice failed to load, **fall back to Whisper** for all languages.

### 4.2 Preload both at startup
Extend `lifespan` to warm up **both** engines so the first Chinese and first
English request are both fast and any load error surfaces at boot, not mid-request.
Load failures must **not** crash the server — log and continue (Whisper is the
guaranteed baseline).

### 4.3 Graceful degradation (critical)
- funasr/torch may not be installed yet. `sensevoice_transcribe.py` must import
  funasr **lazily inside the loader** and catch `ImportError`. If unavailable,
  mark SenseVoice disabled and route everything to Whisper. Server still boots.
- This lets the team `pip install` on their own schedule and A/B safely.

---

## 5. Implementation steps

### Step 1 — New service `server/src/services/sensevoice_transcribe.py`
Mirror the Whisper service interface. Key points:
- Env: `SENSEVOICE_MODEL` (default `"iic/SenseVoiceSmall"`), `SENSEVOICE_DEVICE`
  (default `"cpu"`), `SENSEVOICE_ENABLED` (default `"1"`).
- Singleton `AutoModel` behind a lock, lazy funasr import.
- SenseVoice emits special tags (language/emotion/event) — strip them with
  `funasr.utils.postprocess_utils.rich_transcription_postprocess`.
- Convert input to 16kHz mono WAV first (see Step 4) for reliable m4a decoding.
- Expose:
  - `sensevoice_available() -> bool`
  - `preload() -> None`  (used by lifespan)
  - `transcribe_audio(audio_path: Path, language: str | None = None) -> str`

Reference implementation:
```python
"""SenseVoice-Small transcription via FunASR (Chinese-first STT)."""
from __future__ import annotations
import logging, os, time
from pathlib import Path
from threading import Lock

logger = logging.getLogger(__name__)

SENSEVOICE_MODEL = os.getenv("SENSEVOICE_MODEL", "iic/SenseVoiceSmall")
SENSEVOICE_DEVICE = os.getenv("SENSEVOICE_DEVICE", "cpu")
SENSEVOICE_ENABLED = os.getenv("SENSEVOICE_ENABLED", "1").strip() not in ("0", "false", "")

_model = None
_load_failed = False
_lock = Lock()

# FunASR language codes: "zh", "yue", "en", "ja", "ko", or "auto".
_LANG_MAP = {"zh": "zh", "yue": "yue", "en": "en", "ja": "ja", "ko": "ko"}


def sensevoice_available() -> bool:
    return SENSEVOICE_ENABLED and not _load_failed


def _get_model():
    global _model, _load_failed
    if _model is not None or _load_failed:
        return _model
    with _lock:
        if _model is None and not _load_failed:
            try:
                from funasr import AutoModel  # lazy: torch is heavy / optional
                logger.info("Loading SenseVoice model: %s (device=%s)",
                            SENSEVOICE_MODEL, SENSEVOICE_DEVICE)
                _model = AutoModel(
                    model=SENSEVOICE_MODEL,
                    device=SENSEVOICE_DEVICE,
                    disable_update=True,
                    # A VAD front-end helps on longer clips; optional:
                    # vad_model="fsmn-vad", vad_kwargs={"max_single_segment_time": 30000},
                )
            except Exception as exc:  # ImportError or download/init failure
                _load_failed = True
                logger.warning("SenseVoice unavailable, will fall back to Whisper: %s", exc)
    return _model


def preload() -> None:
    if SENSEVOICE_ENABLED:
        _get_model()


def transcribe_audio(audio_path: Path, language: str | None = None) -> str:
    from funasr.utils.postprocess_utils import rich_transcription_postprocess
    model = _get_model()
    if model is None:
        raise RuntimeError("SenseVoice model is not available")

    lang = _LANG_MAP.get((language or "").lower(), "auto")
    start = time.monotonic()
    res = model.generate(
        input=str(audio_path),
        language=lang,          # "zh" strongly recommended for Chinese
        use_itn=True,           # inverse text normalization (digits, $, punctuation)
        batch_size_s=60,
    )
    raw = res[0]["text"] if res else ""
    transcript = rich_transcription_postprocess(raw).strip()  # strips <|..|> tags
    logger.info("[SENSEVOICE] Done in %.2fs — lang=%s, length=%d chars",
                time.monotonic() - start, lang, len(transcript))
    return transcript
```

> **ITN note:** `use_itn=True` makes SenseVoice output digits/`$`/punctuation
> (e.g. "$400") rather than spelled-out words — better for downstream extraction.

### Step 2 — Dispatcher in `server/src/routers/voice.py`
Add a SenseVoice import and route inside `_transcribe_with_whisper` (or rename to
`_transcribe`, keeping the old name as an alias). Keep all existing logging and
the `HTTPException` behavior.

```python
from services.whisper_transcribe import transcribe_audio as whisper_transcribe_audio
from services import sensevoice_transcribe

_CHINESE_LANGS = {"zh", "yue", "zh-cn", "zh-tw", "zh-hk"}


def _transcribe_with_whisper(audio_path: Path, language: str | None = None) -> str:
    """Route by language: Chinese → SenseVoice, else → Whisper tiny.
    Falls back to Whisper if SenseVoice is unavailable or errors."""
    lang = (language or "").strip().lower()
    use_sensevoice = lang in _CHINESE_LANGS and sensevoice_transcribe.sensevoice_available()

    if use_sensevoice:
        try:
            logger.info("[STT] Using SenseVoice for language=%s (%s)", lang, audio_path)
            transcript = sensevoice_transcribe.transcribe_audio(audio_path, language=lang)
            logger.info('[SENSEVOICE] Result (%d chars): "%s"', len(transcript), transcript[:300])
            if transcript:
                return transcript
            logger.warning("[SENSEVOICE] Empty transcript, falling back to Whisper")
        except Exception as exc:
            logger.error("[SENSEVOICE] Failed, falling back to Whisper: %s", exc, exc_info=True)

    logger.info('[WHISPER] Using Whisper for language=%s (%s)', lang or 'auto', audio_path)
    try:
        transcript = whisper_transcribe_audio(audio_path, language=language)
        logger.info('[WHISPER] Result (%d chars): "%s"', len(transcript), transcript[:300])
        return transcript
    except Exception as exc:
        logger.error('[WHISPER] Transcription FAILED for %s: %s', audio_path, exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f'Whisper transcription failed: {exc}') from exc
```

> The endpoint `voice_transcribe` needs **no change** — it already computes
> `voice_language` and calls `_transcribe_with_whisper(temp_path, language=voice_language)`.

### Step 3 — Preload both at startup in `server/src/main.py`
```python
from services import whisper_transcribe, sensevoice_transcribe

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    # Warm up both STT engines so first request (either language) is fast and
    # load errors surface at boot. Neither failure should crash startup.
    try:
        whisper_transcribe._get_model()
        logger.info("Whisper model preloaded.")
    except Exception as exc:
        logger.error("Whisper preload failed: %s", exc, exc_info=True)
    try:
        sensevoice_transcribe.preload()
        logger.info("SenseVoice preload attempted (available=%s).",
                    sensevoice_transcribe.sensevoice_available())
    except Exception as exc:
        logger.error("SenseVoice preload failed: %s", exc, exc_info=True)
    yield
```
> Model load is blocking/CPU-bound; for a cleaner async boot, optionally wrap each
> preload in `await anyio.to_thread.run_sync(...)`. Not required for correctness.

### Step 4 — 16kHz mono WAV conversion (add to `audio_convert.py`)
FunASR/SenseVoice wants 16kHz mono PCM and may not decode m4a directly. Add:
```python
def convert_audio_to_wav16k(source_path: Path, target_path: Path) -> Path:
    last_error = None
    for candidate in FFMPEG_CANDIDATES:
        try:
            completed = subprocess.run(
                [candidate, '-y', '-i', str(source_path),
                 '-vn', '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', str(target_path)],
                capture_output=True, text=True, check=False,
            )
        except FileNotFoundError:
            continue
        if completed.returncode == 0 and target_path.exists():
            return target_path
        last_error = (completed.stderr or completed.stdout or '').strip()
    raise RuntimeError(last_error or 'ffmpeg not found for wav conversion')
```
Then in `sensevoice_transcribe.transcribe_audio`, convert to a temp WAV before
`model.generate` (delete the temp WAV in a `finally`). Pseudocode:
```python
import tempfile
from services.audio_convert import convert_audio_to_wav16k
...
wav = Path(tempfile.mkstemp(suffix=".wav")[1])
try:
    convert_audio_to_wav16k(audio_path, wav)
    res = model.generate(input=str(wav), language=lang, use_itn=True, batch_size_s=60)
    ...
finally:
    wav.unlink(missing_ok=True)
```
> If testing shows FunASR decodes the client's m4a directly, this conversion can
> be skipped — but converting is the safe default and reuses existing ffmpeg.

### Step 5 — Dependencies `D:\apps\rentzu\requirements.txt`
Add (keep faster-whisper):
```
funasr>=1.1.0
torch>=2.1.0
torchaudio>=2.1.0
```
Install into the existing venv:
```
D:\apps\rentzu\.venv\Scripts\pip install -U funasr torch torchaudio
```
> ⚠️ **Environment gotcha (from prior work):** this machine has TLS interception
> that silently truncates large downloads via Node/Electron; pip/Python networking
> has generally worked, but if model/wheel downloads fail or truncate, prefer a
> pre-downloaded wheel/model cache. First `AutoModel(...)` call downloads
> SenseVoiceSmall (~a few hundred MB) from ModelScope/HF into the HF cache.
> Set `HF_ENDPOINT=https://hf-mirror.com` or use ModelScope if HF is blocked.

### Step 6 — Config / env summary
| Env var | Default | Meaning |
|---|---|---|
| `SENSEVOICE_ENABLED` | `1` | Master toggle; `0` = Whisper for all langs |
| `SENSEVOICE_MODEL` | `iic/SenseVoiceSmall` | Model id (HF/ModelScope) |
| `SENSEVOICE_DEVICE` | `cpu` | `cpu` or `cuda` |
| `WHISPER_MODEL_NAME` | `tiny` | Unchanged; English path |
| `WHISPER_LANGUAGE` / `WHISPER_INITIAL_PROMPT` | — | Unchanged |

---

## 6. Testing / validation plan
1. **Boot with SenseVoice absent** (before pip install): server starts, logs
   "SenseVoice unavailable… fall back to Whisper", English + Chinese both work via
   Whisper. Proves graceful degradation.
2. **After pip install:** boot logs "SenseVoice preload attempted (available=True)".
3. **English clip** (`language='en'`): logs show `[WHISPER] Using Whisper` — path
   unchanged, transcript + extraction identical to today.
4. **Chinese clip** (`language='zh'`): logs show `[STT] Using SenseVoice`; verify
   transcript quality vs old Whisper-tiny on the same clip. Confirm tags are
   stripped and digits/`$` render via ITN.
5. **A/B on real data:** run a handful of your actual EN and ZH voice notes
   through both engines; compare. This matters more than any vendor benchmark.
6. **Fallback path:** temporarily set `SENSEVOICE_MODEL` to a bad id → Chinese
   request must fall back to Whisper without 500s.
7. **Extraction unchanged:** confirm `_extract_records_from_text` still receives a
   plain transcript string and produces the same JSON records.

---

## 7. Risks & mitigations
| Risk | Mitigation |
|---|---|
| torch/torchaudio install size (~1–2 GB) | Accept for v1; or use sherpa-onnx (Alt B, §8) |
| First-run model download blocked by TLS/proxy | HF mirror / ModelScope; pre-seed HF cache |
| Startup slower (two models) | Preload is one-time; both are small/CPU-fast |
| m4a not decoded by FunASR | Convert to 16kHz mono WAV first (Step 4) |
| SenseVoice output tags leak into extraction | `rich_transcription_postprocess` strips them |
| English regression | English never routes to SenseVoice; stays on Whisper |
| SenseVoice load/runtime failure | Marked unavailable → automatic Whisper fallback |

---

## 8. Alternatives considered (not chosen for v1)
- **Alternative A — FunASR/torch (CHOSEN):** simplest code (`AutoModel.generate`),
  official path, heavy dependency.
- **Alternative B — sherpa-onnx SenseVoice INT8** (`sherpa-onnx-sense-voice-...-int8`):
  same model, **no torch** (much lighter footprint, matches OpenWhispr's runtime
  style), but more manual setup (download ONNX + tokens, wire the recognizer API).
  Recommend switching to this if the torch footprint is unacceptable in prod.
- **Do nothing / bump Whisper size** (`tiny → small/medium`): improves both langs
  somewhat but Chinese still trails SenseVoice and larger Whisper is slower on CPU.
- **Paraformer-Large / Fun-ASR-Nano:** worse CER and/or much slower on CPU than
  SenseVoice-Small per §2.1. Not worth it here.

---

## 9. File change checklist (for the implementer)
- [ ] **Add** `server/src/services/sensevoice_transcribe.py` (Step 1).
- [ ] **Add** `convert_audio_to_wav16k` to `server/src/services/audio_convert.py` (Step 4).
- [ ] **Edit** `server/src/routers/voice.py`: import SenseVoice + reroute
      `_transcribe_with_whisper` (Step 2). Endpoint body unchanged.
- [ ] **Edit** `server/src/main.py`: preload both engines in `lifespan` (Step 3).
- [ ] **Edit** `requirements.txt`: add funasr, torch, torchaudio (Step 5).
- [ ] `pip install` into `D:\apps\rentzu\.venv` (Step 5).
- [ ] Validate per §6. Keep `transcribe_audio()` signatures intact throughout.
- [ ] **Do NOT touch** extraction (`_extract_records_from_text`), DB insert, client
      capture/upload, or `whisper_transcribe.py`'s public signature.
```
