# OWLIA Backlog

Status: `[ ]` todo · `[~]` in-progress · `[x]` done · `[!]` blocked

---

## Epic 1 — Project Foundation

| ID | Task | Notes |
|---|---|---|
| BL-001 | `[x]` Create directory structure + docs | Done |
| BL-002 | `[x]` Create `owlia.slnx` + 4 C# projects | Host, Core, Data, AI — net10.0 |
| BL-003 | `[x]` Add NuGet packages to each project | Done |
| BL-004 | `[x]` Create React+TypeScript frontend (Vite) | React 19, Tailwind v4, router, theme store |
| BL-005 | `[x]` Configure Photino.NET to serve built React | wwwroot static serving |
| BL-006 | `[x]` Set up Log4Net with rolling file appender | logs/owlia.log |
| BL-007 | `[x]` Set up SQLite + EF Core, DbContext, migrations | data/owlia.db, InitialCreate migration |
| BL-008 | `[x]` Git init, .gitignore, push to GitHub | biswa6688/owlia |

---

## Epic 2 — ONNX Model Management

| ID | Task | Notes |
|---|---|---|
| BL-010 | `[x]` Write `models/models.json` manifest | 7 models |
| BL-011 | `[x]` `ModelManager.cs` — download with progress, SHA256 validate | HttpClient streaming, optional SHA256 |
| BL-012 | `[x]` `ModelApi.cs` — GET `/api/models`, POST `/api/models/download` | Background download + SignalR |
| BL-013 | `[x]` Download Page UI — model status table + per-model progress bar | Real-time via SignalR |
| BL-014 | `[x]` Feature gating — disable Playground features until required models ready | `ModelGate` component + `useModelStore` |

---

## Epic 3 — AI Pipeline (Backend)

| ID | Task | Notes |
|---|---|---|
| BL-020 | `[x]` `SileroVadRunner.cs` | Returns `VadSegment[]` |
| BL-021 | `[x]` `WhisperRunner.cs` | Greedy decode, log-mel spectrogram |
| BL-022 | `[x]` `SegmentationRunner.cs` | Sliding window, boundary dedup |
| BL-023 | `[x]` `EmbeddingRunner.cs` | L2-normalised ECAPA-TDNN embeddings |
| BL-024 | `[x]` Diarization clustering | `SpeakerClusterer.cs` — agglomerative, cosine, threshold 0.35 |
| BL-025 | `[x]` `SentimentRunner.cs` | RoBERTa softmax → 0-100 |
| BL-026 | `[x]` `SummaryRunner.cs` | BART greedy + keyword/takeaway extraction |
| BL-027 | `[x]` `KokoroRunner.cs` | 24 kHz WAV output |
| BL-028 | `[x]` Audio extraction helper | ffmpeg f32le pipe + NAudio Span fallback |
| BL-029 | `[x]` `TranscriptService.cs` | Full orchestrator + IPipelineNotifier |

---

## Epic 4 — Backend API

| ID | Task | Notes |
|---|---|---|
| BL-030 | `[x]` `MediaApi.cs` | POST /api/media/analyze |
| BL-031 | `[x]` `TranscriptApi.cs` | GET transcript/sentiment/summary |
| BL-032 | `[x]` `HistoryApi.cs` | GET/DELETE history |
| BL-033 | `[x]` `TtsApi.cs` | POST /api/tts → audio/wav |
| BL-034 | `[x]` `CliApi.cs` | GET status, POST query (context cache, stdout streaming) |
| BL-035 | `[x]` `ProgressHub.cs` | SignalR hub + session groups + SignalRPipelineNotifier |

---

## Epic 5 — Flash Screen

| ID | Task | Notes |
|---|---|---|
| BL-040 | `[x]` Owl SVG animation — scale-in + glow pulse | Framer Motion spring + infinite box-shadow |
| BL-041 | `[x]` Brand name letter-by-letter reveal | Stagger 0.12s per letter |
| BL-042 | `[x]` Tagline fade in | |
| BL-043 | `[x]` Auto-navigate to Landing at 5s | + linear progress bar |

---

## Epic 6 — Landing Page

| ID | Task | Notes |
|---|---|---|
| BL-050 | `[x]` Hero section — animated bg, CTA | |
| BL-051 | `[x]` Features grid — 6 cards | |
| BL-052 | `[x]` How It Works — 5-step pipeline | |
| BL-053 | `[x]` FAQ accordion — 6 questions | AnimatePresence |
| BL-054 | `[x]` Navigation header — sticky, blur backdrop | |
| BL-055 | `[x]` CTA footer | |

---

## Epic 7 — Media Player

| ID | Task | Notes |
|---|---|---|
| BL-060 | `[x]` Full-viewport player | HTML5 video |
| BL-061 | `[x]` Controls bar: play/pause, seek, ±10s, speed, volume, time | |
| BL-062 | `[x]` Subtitle overlay (VLC-style) | Active-segment driven |
| BL-063 | `[x]` Fullscreen toggle | Fullscreen API |
| BL-064 | `[x]` Add media button + file input | |
| BL-065 | `[x]` Drag media file onto player | onDrop handler |
| BL-066 | `[x]` Voice spectrum visualizer | Canvas WebAudio API — `VoiceSpectrum.tsx`, animated frequency bars |

---

## Epic 8 — Playground Transcript Tab

| ID | Task | Notes |
|---|---|---|
| BL-070 | `[x]` Segment list: speaker badge + timestamp + text + sentiment icon | |
| BL-071 | `[x]` Auto-scroll to current segment | scrollIntoView |
| BL-072 | `[x]` Click segment → seek player | |
| BL-073 | `[x]` Highlight active segment | Amber border + tinted bg |
| BL-074 | `[x]` Speaker color coding | speakerColor() hue cache |

---

## Epic 9 — Playground Sentiment Tab

| ID | Task | Notes |
|---|---|---|
| BL-080 | `[x]` Speaker cards with overall sentiment progress bar | |
| BL-081 | `[x]` Color: 0-40 red, 41-60 yellow, 61-100 green | ProgressBar.tsx |
| BL-082 | `[x]` Sentence timeline | Proportional, speaker hue + opacity |

---

## Epic 10 — Playground Summary Tab

| ID | Task | Notes |
|---|---|---|
| BL-090 | `[x]` Summary text block | |
| BL-091 | `[x]` Keywords — pill badges | Badge.tsx |
| BL-092 | `[x]` Key takeaways — numbered list | |

---

## Epic 11 — History Page

| ID | Task | Notes |
|---|---|---|
| BL-100 | `[x]` Session grid cards | Filename, duration, speakers, date |
| BL-101 | `[x]` Click card → open session in Playground | sessionId in store; segments/sentiment/summary fetched on mount |
| BL-102 | `[x]` Delete session with confirmation | Inline overlay |

---

## Epic 12 — Theme System

| ID | Task | Notes |
|---|---|---|
| BL-110 | `[x]` CSS custom property design tokens | |
| BL-111 | `[x]` System theme auto-detection | |
| BL-112 | `[x]` Theme toggle component | ThemeToggle.tsx, Zustand |

---

## Epic 13 — CLI Integration

| ID | Task | Notes |
|---|---|---|
| BL-120 | `[x]` Detect claude + opencode in PATH | `where` |
| BL-121 | `[x]` CLI selector UI | Claude / OpenCode buttons in CliPanel |
| BL-122 | `[x]` Download links if CLI not found | In CliPanel + Download page |
| BL-123 | `[x]` Context manager — write session JSON to temp, cache | CliApi.cs `_contextCache` |
| BL-124 | `[x]` Query UI — text input → stream CLI response | `CliPanel.tsx` — full chat, SignalR streaming, Shift+Enter newline |

---

## Epic 14 — Distribution

| ID | Task | Notes |
|---|---|---|
| BL-130 | `[x]` `owlia-setup.iss` InnoSetup 6 script | Bundles app + ffmpeg; models not included |
| BL-131 | `[x]` `build.ps1` — dotnet publish + vite build + copy + installer | `./build.ps1` or `./build.ps1 -SkipInstaller` |
| BL-132 | `[ ]` Sign executable | Optional — self-signed; add SignTool to setup.iss when cert available |

---

## Epic 15 — Model Manifest & VAD Fixes (2026-08-28)

| ID | Task | Notes |
|---|---|---|
| BL-140 | `[x]` Fix all 7 broken model manifest URLs | Every URL curl-verified before use; see `docs/MEMORY.md` |
| BL-141 | `[x]` Multi-file model support (encoder+decoder, external `.onnx_data`) | `ModelManager.cs` rewritten, `files:[]` manifest schema |
| BL-142 | `[x]` Fix `SileroVadRunner` v4→v5 input mismatch | Verified against real model's `InputMetadata` |
| BL-143 | `[x]` Speech percentage metric (VAD-derived) | Backend done; `SummaryView.tsx` display — todo |
| BL-144 | `[x]` Window icon (exe + Photino window) | `assets/owlia.ico` generated, wired both places |
| BL-145 | `[x]` Brand-colored title bar | `DwmSetWindowAttribute`/`DWMWA_CAPTION_COLOR`, Win11 only |
| BL-146 | `[x]` InnoSetup icon | `SetupIconFile` + `UninstallDisplayIcon` |

---

## Epic 16 — Engine Swaps (agreed 2026-08-28 — Whisper.net/sherpa-onnx/LLamaSharp all done same day; Kokoro/TTS deferred)

| ID | Task | Notes |
|---|---|---|
| BL-150 | `[x]` Whisper → Whisper.net (whisper.cpp/GGML) | `WhisperRunner` rewritten around `WhisperFactory`/`WhisperProcessor`. Model is now single-file `ggml-large-v3.bin` (3.1GB, was 4 files/6.2GB ONNX). Functionally verified: real SAPI-synthesized speech → correct transcript + timestamps via `ggml-tiny.bin` |
| BL-151 | `[x]` VAD + diarization → sherpa-onnx | `SileroVadRunner` rewritten around `VoiceActivityDetector`; `EmbeddingRunner`+`SegmentationRunner`+`SpeakerClusterer` retired, replaced by one `DiarizationRunner` wrapping `OfflineSpeakerDiarization` (segmentation+embedding+clustering in one call). Functionally verified: 3 spoken sentences → 3 correctly-bounded VAD segments (77.4% speech) + 3 matching diarization segments, correct single speaker |
| BL-152 | `[!]` TTS → sherpa-onnx Kokoro module | **Blocked/deferred** — sherpa-onnx's Kokoro needs `model.onnx` + `voices.bin` + `tokens.txt` + an `espeak-ng-data/` directory (many small files), only distributed as a `.tar.bz2` release archive. Doesn't fit the current per-file manifest without adding archive-extraction support to `ModelManager`. Current `kokoro-onnx` single-file TTS runner stays as-is — it already works and isn't the KV-cache-decode-loop class of bug the other swaps fixed. Revisit if archive support gets added for another reason |
| BL-153 | `[x]` Summarization → small local LLM via LLamaSharp | `SummaryRunner` rewritten around `Qwen2.5-1.5B-Instruct` GGUF via `StatelessExecutor.InferAsync`. Summary+keywords+takeaways all in one prompted call, parsed from a labeled-section format. Functionally verified against the real class with a real transcript — coherent summary, clean keywords, clean numbered takeaways |
| BL-154 | `[ ]` `SummaryView.tsx` speech-percentage display | Backend (BL-143) already exposes it via `/api/summary` |
| BL-155 | `[x]` Rebuild `models.json` manifest for new engines' model files | Done incrementally per swap: `silero_vad.onnx`/`pyannote-seg-3.0.onnx`/`wespeaker_en_voxceleb_resnet34_LM.onnx` (sherpa-onnx), `ggml-large-v3.bin` (Whisper.net), `qwen2.5-1.5b-instruct-q5_k_m.gguf` (LLamaSharp, replaces `bart-cnn`) |

---

## Epic 17 — Download Page: Pause/Resume/Cancel, Update Check (2026-08-28)

| ID | Task | Notes |
|---|---|---|
| BL-160 | `[x]` Model display names | `models.json` "displayName" field, shown on Download page |
| BL-161 | `[x]` Pause a model download | `POST /api/models/pause` — cancels the in-flight transfer, keeps the `.tmp` file |
| BL-162 | `[x]` Resume a paused download | Same `POST /api/models/download` call — `ModelManager` detects the `.tmp` and sends `Range: bytes={size}-`. Byte-level verified: paused at 101.8MB, resumed to 114MB, not restarted from 0 |
| BL-163 | `[x]` Cancel a download | `POST /api/models/cancel` — deletes the `.tmp` file(s), resets status |
| BL-164 | `[x]` Multi-file resume at the file level | `DownloadAsync` skips files whose final path already exists — a completed encoder doesn't re-download when resuming a paused decoder |
| BL-165 | `[x]` Update-check setting (CLI + models) | `GET /api/updates/check` — npm registry `latest` dist-tag for CLIs, remote `Content-Length` vs. recorded size for models. Opt-in toggle (`useSettingsStore`, localStorage, default off), manual "Check now" button. **Never auto-downloads or auto-installs** — purely informational badges |
| BL-166 | `[x]` Circular progress ring on Pause button | Replaces the separate spinning loader icon — `conic-gradient` ring on the button border shows percent directly |

---

## Epic 18 — Critical Fix: Media Upload (2026-08-28)

| ID | Task | Notes |
|---|---|---|
| BL-170 | `[x]` Fix `/api/media/analyze` always returning "File not found" | Root cause: frontend read `File.path`, an Electron-only property — doesn't exist in WebView2/browsers, silently fell back to bare filename. **This broke Playground analysis entirely, for every input method.** Fixed with a real upload step: `POST /api/media/upload` (multipart) saves bytes server-side, returns the real path. Kestrel body-size limit and multipart form limit both raised (loopback-only, single-user — safe). Round 1 fix missed a second bug — the shared axios instance's default `Content-Type: application/json` persists over `FormData` and blocks the browser's multipart boundary negotiation; needs `headers: {'Content-Type': undefined}` on the upload call. Both bugs reproduced and fixed verified in a real Edge browser (not curl, which doesn't exhibit the header bug) |
| BL-171 | `[x]` Real Claude/OpenCode brand icons | Sourced from simple-icons (CC0), wired into Download page CLI cards + `CliPanel.tsx` badge/selector/empty-state. Screenshot-verified |

---

## Epic 20 — Critical Fix: Transcript 404 Race Condition (2026-08-28)

| ID | Task | Notes |
|---|---|---|
| BL-190 | `[x]` Fix `GET /api/transcript/{id}` 404 immediately after analyze | Root cause: session row was inserted inside the background pipeline `Task.Run`, but `sessionId` was returned to the caller before that write landed — frontend's immediate session-restore fetch could race ahead of it. Fixed by making the session-row insert synchronous in `AnalyzeAsync`, awaited before the id is returned. Verified with zero-delay upload→analyze→fetch: now `200 {"segments":[]}`, not `404` |

---

## Epic 19 — Playground Layout: VS Code-style Activity Bar (in progress)

| ID | Task | Notes |
|---|---|---|
| BL-180 | `[ ]` Right-side icon rail (Chat/Sentiment/Transcript/Summary), click opens as single active panel | Replaces the current always-visible multi-column tab layout |

---

## Remaining

- BL-132: Code signing (needs certificate — deferred)
- E2E smoke test with real models, ideally after Epic 16 lands (current ONNX runners work but are being replaced)
- Optional: WaveSurfer.js integration (replaced with custom canvas — BL-066 done)
- Optional: lazy code-splitting in Vite (chunk size warning — non-blocking)
