# Changelog

All notable changes to OWLIA are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) — Semantic Versioning.

---

## [Unreleased]

### Fixed — Session 12 (race condition: transcript 404 right after analyze)

- **Critical**: `GET /api/transcript/{id}` 404'd immediately after a successful `POST /api/media/analyze` for the same session. Root cause: `AnalyzeAsync` generated the session id, kicked off the entire pipeline (including the session-row DB insert) on a background `Task.Run`, and returned the id to the HTTP caller immediately — before the background task had necessarily even started. The frontend's session-restore effect fires the instant it receives a session id, so it could easily race ahead of the background write and query a session that "didn't exist yet" (it did — the insert just hadn't landed). Fixed by moving the session-row insert to run synchronously in `AnalyzeAsync`, awaited before the background pipeline starts and before the session id is returned — the row is now guaranteed to exist by the time any caller can possibly query it. Verified with the tightest possible race window: upload → analyze → immediately fetch transcript with zero artificial delay, in the same script — now returns `200 {"segments":[]}` instead of `404`.

### Added — Session 11 (real Claude/OpenCode brand icons)

- Claude and OpenCode CLI cards (Download page) and the chat panel's CLI badge/selector/empty-state icons now use the real brand marks instead of generic `Terminal`/`Cpu` icons — sourced from simple-icons (CC0), not approximated. New `icBrand()` icon helper renders solid-fill logos (vs. the existing line-icon helpers' stroke style).

### Fixed — Session 10 (media upload was completely broken)

- **Critical**: `POST /api/media/analyze` always 400'd with "File not found" for any real user-selected file. Root cause: the frontend read `mediaFile.path`, an Electron-only `File` property that doesn't exist in a browser/WebView2 — it silently fell back to `mediaFile.name` (bare filename, no directory), which is never a valid path on disk. This affected every path to Playground analysis (file picker and drag-and-drop alike) — the app could never actually analyze anything a user provided. Fixed by adding a real upload step: new `POST /api/media/upload` (multipart/form-data) saves the file's bytes server-side and returns the real path, which the frontend now passes to `/api/media/analyze` instead of the nonexistent client path. Kestrel's default 30MB request body limit and ASP.NET's form multipart limit were both raised (disabled) to allow large video files — safe here since this is a loopback-only, single-user desktop app.
- **Critical, round 2**: the upload fix above still 400'd in real use — `{"error":"Expected multipart/form-data"}` — because the shared axios instance's default `Content-Type: application/json` header persists over a `FormData` body and blocks the browser from setting its own multipart boundary. `curl -F` had "verified" the endpoint worked because curl doesn't have this header-persistence behavior, masking the real bug. Fixed with `headers: { 'Content-Type': undefined }` on the upload call specifically. Reproduced and confirmed fixed in a real Edge browser using the actual `axios.create()` config from the app (not curl, not Node) — the broken version reproduced the exact reported error, the fixed version succeeded.

### Changed — Session 10 (Download page: circular progress ring)

- The separate spinning "loading" icon next to an in-progress model download is gone — the Pause button itself now shows progress as a `conic-gradient` ring around its border (fills clockwise 0-100%), removing a redundant indicator instead of adding a second one next to it.

### Changed — Session 9 (Summarization → LLamaSharp)

- Summarization now runs on a small local instruct LLM (Qwen2.5-1.5B-Instruct, GGUF) via LLamaSharp/llama.cpp instead of hand-rolled BART ONNX. The previous `SummaryRunner` tokenizer was a placeholder char-mapping hack, not real BPE — this replaces it entirely. Summary, keywords, and takeaways are all produced by a single prompted inference call in a fixed labeled-section format (`SUMMARY:`/`KEYWORDS:`/`TAKEAWAYS:`), parsed with simple string splitting. Model id renamed `bart-cnn` → `summary-llm` throughout (manifest, `TranscriptService`, frontend `modelStore`/`Download` page).
- Functionally verified against the real `SummaryRunner` class (not a reimplementation) with a real multi-speaker transcript: coherent one-paragraph summary, 5 clean keywords, 3 clean numbered takeaways, ~6-10s on CPU.
- This completes the 3-part engine-swap plan agreed earlier this session: Whisper → Whisper.net, VAD+diarization → sherpa-onnx, Summarization → LLamaSharp — all three done and functionally verified the same day. TTS → sherpa-onnx Kokoro remains deferred (BL-152, archive-format blocker).

### Changed — Session 8 (VAD + diarization → sherpa-onnx)

- Voice activity detection and speaker diarization now run on sherpa-onnx (`org.k2fsa.sherpa.onnx`) instead of hand-rolled ONNX. `SileroVadRunner` rewritten around the real `VoiceActivityDetector` API (verified via compile-driven discovery + the project's own real dotnet-examples source, not guessed). `EmbeddingRunner`, `SegmentationRunner`, and `SpeakerClusterer` (whose agglomerative clustering was never independently verified) are retired — replaced by a single `DiarizationRunner` wrapping `OfflineSpeakerDiarization`, which does segmentation, embedding, and clustering internally in one `Process()` call. `TranscriptService`'s diarization step now runs diarization once over the full audio and assigns each transcript segment the speaker of whichever diarization segment overlaps it most, instead of extracting one embedding per transcript segment.
- Model sources switched to sherpa-onnx's own verified-compatible exports (`k2-fsa/sherpa-onnx` GitHub releases + `csukuangfj` HuggingFace mirrors) rather than the generic ONNX community exports used previously — different weight format/I/O contract than plain ONNX Runtime code would expect.
- Functionally verified end-to-end with real synthesized speech (not just compiled): VAD correctly found the 3 spoken sentences (77.4% speech, silence/pauses excluded) and diarization found matching segment boundaries with a single consistent speaker.
- TTS → sherpa-onnx Kokoro module deferred (BL-152) — its model needs a directory of files only shipped as a `.tar.bz2` archive, which the current single-file-per-entry manifest doesn't support yet.

### Changed — Session 7 (Whisper → Whisper.net)

- Speech-to-text now runs on Whisper.net (whisper.cpp/GGML) instead of hand-rolled ONNX. `WhisperRunner` rewritten around the real `WhisperFactory`/`WhisperProcessorBuilder`/`WhisperProcessor` API (verified via DLL string extraction before writing any code, then confirmed by a clean compile). Model manifest simplified from 4 files/~6.2GB (ONNX encoder+decoder+external data) to 1 file/~3.1GB (`ggml-large-v3.bin`). Functionally verified end-to-end with a real synthesized speech clip (Windows SAPI) transcribed through `ggml-tiny.bin` — correct text and timestamps, not just a compile check.

### Added — Session 6 (pause/resume/cancel, update check, display names)

- Download page: pause, resume, and cancel a model download. Resume uses real HTTP `Range` requests continuing an existing `.tmp` file (byte-verified: paused at 101.8MB, resumed to 114MB — not a restart). Multi-file models (Whisper, BART) resume at the file level too — a completed encoder is skipped when resuming a paused decoder.
- Update-check setting: opt-in toggle + manual "Check now" button. `GET /api/updates/check` compares installed CLI versions against the npm registry `latest` tag, and downloaded models' recorded size against the source's current `Content-Length`. Purely informational — never downloads or installs anything automatically, matching the "no auto updates" requirement. Live-verified against the real npm registry.
- Model manifest entries now carry a `displayName` (e.g. "Whisper Large v3") shown on the Download page instead of just the internal id/feature category.

### Fixed — Session 5 (model manifest, VAD version, window branding)

- **Critical**: all 7 URLs in `models/models.json` returned 404/401 — pointed at orgs that don't host ONNX exports at those paths. Verified real replacement URLs via `curl` for every model before writing them. Whisper large-v3 and BART-CNN have no single-file ONNX export anywhere; manifest schema changed to `files: [...]` per model (multi-file support), `ModelManager.cs` rewritten to download/verify all files per model with cumulative progress, `TranscriptService.cs`/`SummaryRunner.cs` wired to the encoder+decoder paths. Real total download size is ~8.9GB (was documented ~5.7GB).
- **Critical**: `SileroVadRunner.cs` sent v4-era ONNX inputs (`h`/`c` separate `[2,1,64]` state tensors) against what is actually a v5 model (current `snakers4/silero-vad`). Verified real input signature via `InferenceSession.InputMetadata` on the downloaded file (`input`, `sr`, single `state`[2,1,128] tensor) and rewrote to match, including the 64-sample rolling context window v5 requires. Functionally verified against the real model (silence/noise correctly score near-zero probability).
- Window showed the default OS icon and default title bar color despite branding being requested. Generated `assets/owlia.ico` from the SVG (throwaway C# rasterizer, no SVG tool was installed). Wired `<ApplicationIcon>` (exe icon), `window.SetIconFile()` (Photino window icon), and a brand-colored title bar via the real Win32 `DwmSetWindowAttribute`/`DWMWA_CAPTION_COLOR` API (Photino has no cross-platform titlebar-color API — confirmed by exhaustively enumerating its DLL's exported methods). Added `SetupIconFile` to the InnoSetup script. Screenshot-verified.

### Added — Session 5

- `SummaryResult.SpeechPercentage` / `SummaryEntity.SpeechPercentage` — percentage of media that is actual speech per Silero VAD (silence/noise excluded), computed from existing VAD segments, no new model needed. EF migration `AddSpeechPercentage`. Backend only so far — frontend display not yet added.

### Fixed — Session 4 (Photino window rendering blank)

- **Critical**: `Owlia.Host` window opened with correct native title bar but a permanently blank white content area — WebView2 was silently never initializing (confirmed via process tree: `msedgewebview2.exe` never spawned as a child of `Owlia.Host.exe`, with no exception or log error). Root cause: `Program.cs` used C# top-level statements, so the entry thread ran MTA (the .NET default); WebView2 requires an STA window-creating thread. Fixed by converting to an explicit `[STAThread] static void Main`. Verified via screenshot — same content that already rendered correctly in a real browser now renders identically inside the Photino window.
- Kestrel port was previously hardcoded (5174 in dev via `appsettings.Development.json`, random `:0` in prod) with an `IsDevelopment()` branch. Unified into a single configurable `Owlia:Port` setting (`appsettings.json`, `Owlia__Port` env var, or `--Owlia:Port=` CLI arg; `0` = random) used in both environments. Frontend `vite.config.ts` dev-proxy target now reads `OWLIA_BACKEND_PORT` env var instead of a hardcoded constant.

### Added — Session 3 (feature gating, spectrum, CLI chat, session restore, installer)

**Frontend**
- `src/store/modelStore.ts` — Zustand store: loads `ModelStatus[]` from API; `isReady(feature)` checks required models against `MODEL_REQUIREMENTS` map; `refresh()` called on Playground mount + after analysis
- `src/components/UI/ModelGateBanner.tsx` — `ModelGate` wrapper: shows "models required" banner with missing model IDs + link to Download page; transparent when models loaded or list empty
- `src/components/VoiceSpectrum/VoiceSpectrum.tsx` — canvas WebAudio API visualizer: connects `MediaElementAudioSourceNode` → `AnalyserNode` → destination; draws rounded frequency bars with amplitude-driven opacity; flat idle state when paused; resumes AudioContext on play
- `src/components/Cli/CliPanel.tsx` — full CLI chat panel: auto-detects available CLIs (Claude / OpenCode), selector buttons, streaming assistant responses via SignalR `CliResponse` events, user/assistant message bubbles, Shift+Enter newline, "no CLI" warning with install links
- `Playground.tsx` — rewritten with: session restore on mount (fetches segments/sentiment/summary from API when `sessionId` set but no segments), `VoiceSpectrum` above controls bar, `ModelGate` wrapping each tab, "⚠ Models needed" button links to Download when Whisper/VAD missing, CLI tab (`🤖 Ask AI`) added to tab bar, inline `--css-vars` override for dark Playground theme
- All pages: model status refreshed after analysis completes

**Distribution**
- `setup/owlia-setup.iss` — InnoSetup 6 script: bundles self-contained win-x64 publish, optional `ffmpeg.exe`, `models/models.json`; creates Start Menu + optional Desktop shortcut; uninstaller; no ONNX models bundled
- `build.ps1` — PowerShell build script: `npm ci` + `vite build` → `npm run build`, `dotnet publish` self-contained win-x64, copies wwwroot + models.json into publish dir, runs ISCC; flags: `-SkipFrontend`, `-SkipInstaller`, `-Configuration`

### Added — Session 2 (AI pipeline + full UI)

**Backend**
- `IPipelineNotifier` interface in `Owlia.Core` — decouples AI runners from SignalR/Host
- `ProgressHub` SignalR hub with session groups (`JoinSession` / `LeaveSession`)
- `SignalRPipelineNotifier` — routes pipeline events to the correct session group
- `ModelManager` — downloads ONNX models via `HttpClient` streaming with SHA256 validation; reads `models/models.json` manifest
- `TranscriptService` — full pipeline orchestrator (VAD → ASR → Diarize → Sentiment → Summary); graceful model-not-found fallback; streams `TranscriptSegment` + `AnalysisProgress` events
- `SentimentService` — loads per-segment scores from DB, groups by speaker
- `SummaryService` — reads `SummaryEntity` from DB, deserialises JSON arrays
- `TtsService` — delegates to `KokoroRunner`, returns WAV bytes
- `AudioHelper` — ffmpeg PCM pipe (f32le) with NAudio 3.x `Span<float>` fallback
- `SileroVadRunner` — chunk-based VAD, configurable threshold + silence/pad durations
- `WhisperRunner` — log-mel spectrogram (Hann window, mel filterbank), greedy decoder
- `SegmentationRunner` — sliding window pyannote seg, boundary dedup
- `EmbeddingRunner` — WeSpeaker ECAPA-TDNN, L2-normalised embeddings
- `SpeakerClusterer` — agglomerative cosine clustering (threshold 0.35)
- `SentimentRunner` — RoBERTa 3-class softmax → 0-100 score mapping
- `SummaryRunner` — BART greedy decode + TF-IDF keyword extraction + sentence takeaways
- `KokoroRunner` — Kokoro v1.0 synthesis, 24 kHz WAV output
- All API endpoints wired in `Program.cs`: health, models, media, transcript, sentiment, summary, history, tts, cli
- `ISessionRepository.UpdateAsync` added; `SessionRepository` updated
- `models/models.json` — 7-model manifest (silero, whisper, pyannote, wespeaker, roberta, bart, kokoro)

**Frontend**
- `src/api/client.ts` — typed axios API layer for all endpoints + TypeScript interfaces
- `src/api/signalr.ts` — singleton SignalR hub connection, `joinSession` / `leaveSession`
- `src/store/playgroundStore.ts` — Zustand store: media, session, analysis state, segments, sentiment, summary, `speakerColor()` hue cache
- `FlashScreen.tsx` — full Framer Motion animation: owl scale spring + amber glow pulse, letter-by-letter brand reveal (stagger 0.12s), tagline fade, linear progress bar
- `Landing.tsx` — full landing page: sticky nav with blur backdrop, hero with radial orb animation, features grid (6 cards), 5-step how-it-works, FAQ accordion (AnimatePresence), CTA footer
- `Playground.tsx` — HTML5 media player (video + audio), VLC-style controls bar (play/pause, ±10s, speed selector, seek bar, volume), subtitle overlay, drag-and-drop, fullscreen API, Analyse button, SignalR-driven real-time segment streaming, Transcript/Sentiment/Summary tabs
- `TranscriptList.tsx` — segment cards with speaker color badge, timestamp, text, sentiment emoji; active highlight (amber border + tinted bg); auto-scroll; seek on click
- `SentimentView.tsx` — per-speaker progress bars (red/yellow/green), proportional sentence timeline
- `SummaryView.tsx` — summary paragraph, keyword pill badges, numbered takeaway list
- `History.tsx` — responsive grid of session cards (filename, duration, speakers, date); click to reopen in Playground; inline delete with confirm overlay
- `Download.tsx` — model status table with per-model download button + real-time progress bar; CLI detection (claude + opencode) with install links
- `ProgressBar.tsx`, `Badge.tsx` — shared UI components

---

## [Unreleased — Session 1]

### Added
- Project scaffolding: directory structure, solution layout
- Documentation: README (root + docs), ARCHITECTURE, MEMORY, BACKLOG, CHANGELOG
- Brand assets: `assets/owlia.svg` (owl icon)
- `.gitignore` for .NET + Node + ONNX models
- `owlia.slnx` solution with 4 C# projects (`Owlia.Host`, `Owlia.Core`, `Owlia.Data`, `Owlia.AI`), target `net10.0`
- NuGet packages wired up for all 4 projects
- `Owlia.Core`: domain models + service interfaces
- `Owlia.Data`: EF Core `OwliaDbContext`, entities, `SessionRepository`, initial migration (`InitialCreate`)
- `Owlia.Host`: log4net rolling file appender, Photino window host, ASP.NET Core Minimal API on random localhost port, static file serving, `/api/health` endpoint — verified end-to-end via `dotnet run`
- `Owlia.Web`: React 19 + TypeScript + Vite 8 frontend, Tailwind v4, React Router v7 (5 pages), Zustand theme store (light/dark/system), builds directly into `Owlia.Host/wwwroot`
- Theme system fully implemented (BL-110/111/112)
- Flash screen auto-navigate stub

---

## Planned Releases

### [0.1.0] — Foundation ✓
### [0.2.0] — AI Pipeline ✓ (runners implemented, awaiting model downloads for E2E test)
### [0.3.0] — UI Core ✓
### [0.4.0] — Playground ✓
### [0.5.0] — History + CLI ✓ (CLI query UI pending)
### [0.6.0] — TTS + Distribution (installer pending)
### [1.0.0] — Release
