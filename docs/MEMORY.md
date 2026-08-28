# OWLIA AI Context Memory

This file preserves full project context so AI models do not need to re-read the entire codebase each session. Update sections as features are implemented.

---

## Project Identity

- **Name**: OWLIA — Offline Voice & Language Intelligence Analytics
- **Type**: Desktop app (Photino.NET = native window + embedded Chromium)
- **Platform**: Windows 10/11 x64
- **Repo**: https://github.com/biswa6688/owlia.git
- **Brand icon**: `assets/owlia.svg` (owl, mahogany/amber/gold palette)
- **Build**: `./build.ps1` (PowerShell) — vite build + dotnet publish + InnoSetup

---

## Architecture Summary

Single executable (.exe):
1. Photino.NET window
2. ASP.NET Core Minimal API on random localhost port (`http://127.0.0.1:0`)
3. Serves built React app from `wwwroot/`
4. HTTP + SignalR (localhost only)

---

## Color Palette

```
#6e4f44  primary (dark mahogany brown)
#875d54  primary-mid
#d0805f  copper
#f2a35b  amber (main accent)       → --accent
#feb903  gold (highlight)
#f5dbb8  warm-light (light bg)
#303232  near-black
#878787  gray
```

Dark mode bg `#1a1210`, surface `#2a1f1b`  
Light mode bg `#fef9f4`, surface `#fff5eb`  
Playground always dark: bg `#1a1210`, player `#0d0907`

---

## C# Projects

| Project | Key Dependencies |
|---|---|
| `Owlia.Host` | Photino.NET, AspNetCore, SignalR, log4net, Newtonsoft.Json |
| `Owlia.Core` | — (no external deps) |
| `Owlia.Data` | EFCore.Sqlite, EFCore.Design |
| `Owlia.AI` | OnnxRuntime 1.29, NAudio 3.0.1, SignalR.Core 1.2, Newtonsoft.Json |

---

## React Frontend

- React 19 + TypeScript + Vite 8 + Tailwind v4 (CSS-first)
- Zustand: `themeStore`, `playgroundStore`, `modelStore`
- Router: React Router v7
- Real-time: @microsoft/signalr (singleton in `src/api/signalr.ts`)
- HTTP: axios (`src/api/client.ts` — full typed API)

### Pages
- `/` → FlashScreen (5s animated)
- `/landing` → Landing (hero, features, how-it-works, FAQ, footer)
- `/playground` → Playground (player + spectrum + tabs: Transcript / Sentiment / Summary / Ask AI)
- `/history` → History (session cards, restore, delete)
- `/download` → Download (model status + CLI detection)

### Key Components
- `VoiceSpectrum.tsx` — canvas WebAudio API visualizer (frequency bars, animated)
- `CliPanel.tsx` — full chat UI (Claude/OpenCode, SignalR streaming, Shift+Enter)
- `ModelGate.tsx` — wraps features; shows "download required" banner if models missing
- `TranscriptList.tsx`, `SentimentView.tsx`, `SummaryView.tsx`
- `ProgressBar.tsx`, `Badge.tsx`, `ThemeToggle.tsx`

### Stores
- `themeStore.ts` — `light`/`dark`/`system`; persisted to localStorage `owlia-theme`
- `playgroundStore.ts` — media, sessionId, stage/progress, segments, sentiment, summary, currentTimeMs, activeSegmentIndex; `speakerColor()` hue cache
- `modelStore.ts` — `ModelStatus[]`; `isReady(feature)` checks required models; `MODEL_REQUIREMENTS` map

---

## AI Models (ONNX)

Manifest: `models/models.json`

| ID | File | Feature | ~Size |
|---|---|---|---|
| `silero-vad` | `silero_vad.onnx` | VAD | 2MB |
| `whisper-large-v3` | `whisper-large-v3.onnx` | ASR | 3.1GB |
| `pyannote-seg` | `pyannote-seg-3.0.onnx` | Speaker seg | 80MB |
| `wespeaker-ecapa` | `wespeaker-ecapa-tdnn.onnx` | Speaker embed | 90MB |
| `roberta-sentiment` | `roberta-sentiment.onnx` | Sentiment | 500MB |
| `bart-cnn` | `bart-large-cnn.onnx` | Summary | 1.6GB |
| `kokoro-tts` | `kokoro-v1.0.onnx` | TTS | 300MB |

`MODEL_REQUIREMENTS` in `modelStore.ts`:
- `transcribe` → silero-vad + whisper-large-v3
- `diarize` → pyannote-seg + wespeaker-ecapa
- `sentiment` → roberta-sentiment
- `summary` → bart-cnn
- `tts` → kokoro-tts

---

## Database (SQLite)

File: `data/owlia.db` (relative to exe)

```
Sessions  (Id, FileName, FilePath, DurationSeconds, SpeakerCount, CreatedAt)
Segments  (Id, SessionId, Speaker, StartMs, EndMs, Text, SentimentScore, SentimentLabel, Confidence)
Summaries (Id, SessionId, SummaryText, KeywordsJson, KeyTakeawaysJson, CreatedAt)
```

Repository: `ISessionRepository` with `GetByIdAsync`, `GetAllAsync`, `AddAsync`, `UpdateAsync`, `DeleteAsync`, `AddSegmentsAsync`, `GetSegmentsAsync`, `UpsertSummaryAsync`, `GetSummaryAsync`.

---

## API Surface

```
GET    /api/health
POST   /api/media/analyze          { filePath } → { sessionId }
GET    /api/transcript/{id}        → TranscriptResult
GET    /api/sentiment/{id}         → SentimentResult
GET    /api/summary/{id}           → SummaryResult
GET    /api/models                 → ModelStatus[]
POST   /api/models/download        { modelId } → 202
GET    /api/history                → Session[]
DELETE /api/history/{id}           → 204
POST   /api/tts                    { text, voice? } → audio/wav
GET    /api/cli/status             → { claude: bool, opencode: bool }
POST   /api/cli/query              { sessionId, question, cli } → 202

WS     /hub/progress
```

### SignalR Events
- `ModelDownloadProgress` / `ModelDownloadError`
- `AnalysisProgress` → `{ stage, percent }` (audio/vad/asr/diarization/sentiment/saving/summary/done)
- `TranscriptSegment` → SpeakerSegment (streamed live)
- `AnalysisComplete` / `AnalysisError`
- `CliResponse` → `{ chunk?, done? }`
- `CliError` → `{ error }`

Hub groups: `session:{sessionId}` — clients call `JoinSession(sessionId)`.

---

## Runtime Conventions

- `AppContext.BaseDirectory` — paths for data/, logs/, models/ all relative here
- Kestrel port is **configurable**: `Owlia:Port` in `appsettings.json` (default `5174`), overridable via `Owlia__Port` env var or `--Owlia:Port=xxxx` CLI arg. `0` = OS-assigned random port. Same code path handles both — `builder.WebHost.UseUrls($"http://127.0.0.1:{port}")`, actual bound address always read back via `IServerAddressesFeature` before creating the Photino window. Frontend dev proxy (`vite.config.ts`) reads the matching port from `OWLIA_BACKEND_PORT` env var (default `5174`) — **keep both in sync if you change the default**.
- NAudio 3.x: `ISampleProvider.Read(Span<float>)` (not 3-arg array)
- `dotnet-ef` tool: `C:\Users\Administrator\.dotnet\tools\dotnet-ef.exe`
- All projects target `net10.0`; solution `owlia.slnx`
- **`Program.cs` MUST use an explicit `[STAThread] static void Main`, never top-level statements.** WebView2 needs the window-creating thread to be STA (this matches Photino.NET's own official template). Without it, Photino creates a real native window (title bar renders, correct title, no exception, no error in log) but **never spawns the `msedgewebview2.exe` child process** — the content area is just permanently blank white. This is silent and easy to misdiagnose as a frontend/backend bug; it isn't. Diagnose by checking `Get-CimInstance Win32_Process -Filter "Name='msedgewebview2.exe'" | Where ParentProcessId -eq <Owlia.Host.exe PID>` — if empty, this is the cause. Fixed 2026-08-28.

---

## Build

```powershell
# Development
cd src\Owlia.Web; npm run build   # → wwwroot/
dotnet run --project src\Owlia.Host

# Release installer
.\build.ps1                       # full: vite + publish + InnoSetup
.\build.ps1 -SkipInstaller        # skip InnoSetup
.\build.ps1 -SkipFrontend         # skip vite (if wwwroot already built)
```

---

## Backlog Status

**All epics complete** except:
- BL-132: Code signing (needs certificate)
- E2E test with real ONNX models

**Next action**: the 3 engine swaps below (Whisper.net, sherpa-onnx, LLamaSharp) are agreed but **not yet implemented** — current pipeline still runs the fixed-but-hand-rolled ONNX runners. After those land, re-verify: download models via Download page → drop an audio file in Playground → click Analyse → verify full pipeline.

---

## Session 2026-08-28 (later) — model manifest was entirely broken, VAD had wrong model version, engine-swap plan agreed

**Context:** user reported "models download is missing on download page" → the Download page UI itself was fine (another session/this session had built it), but ALL 7 URLs in `models/models.json` returned 404/401 — they pointed at orgs (`facebook/`, `openai/`, `pyannote/`, `wenet-e2e/`, `hexgrad/`, `cardiffnlp/`) that don't host ONNX exports at those paths. Every URL was verified via `curl -I` before touching anything (`don't hallucinate`).

**Findings, all curl-verified before use:**
- 5 models (silero-vad, pyannote-seg, wespeaker-ecapa, roberta-sentiment, kokoro-tts) have real single-file ONNX exports — fixed directly, sizes updated to real `Content-Length` values.
- Whisper large-v3 and BART-large-CNN have **no single-file ONNX export anywhere** — real HF distributions split seq2seq models into `encoder_model.onnx` + `decoder_model.onnx`/`decoder_model_merged.onnx`. Whisper's files additionally need external `.onnx_data` weight companions (>2GB protobuf limit) — 4 files total, must stay co-located with **exact** filenames (`encoder_model.onnx` + `encoder_model.onnx_data` etc.) so ONNX Runtime's external-data resolution finds them by relative filename.
- The real merged decoder (`decoder_model_merged.onnx`) requires `past_key_values.*` + `use_cache_branch` inputs for KV-cache — neither `WhisperRunner` nor `SummaryRunner`'s existing decode loops feed those. **Fix used**: swap to the plain `decoder_model.onnx` (no-cache variant) instead — it takes only `input_ids`+`encoder_hidden_states`, exactly matching the existing recompute-from-scratch decode loops with zero logic changes. Slower (no cache) but numerically correct — not a hallucinated workaround, verified by checking both files exist at those exact HF paths.

**Manifest schema changed** — every entry is now `{ id, feature, files: [{ fileName, sizeBytes, sha256, url }] }` (was single fileName/url per model). `ModelManager.cs` rewritten: `DownloadAsync` loops files with cumulative progress (same `IProgress<(long,long)>` signature — `ModelApi.cs`/SignalR events untouched), `GetStatusAsync` aggregates downloaded/verified across all files. New `IModelManagerService.GetModelPaths(id)` returns all file paths; `GetModelPath` (singular, unchanged signature) returns the first — 5 single-file models' call sites (`TtsService`, VAD/pyannote/wespeaker/roberta in `TranscriptService`) needed no changes. Whisper/BART call sites in `TranscriptService.cs` switched to `GetModelPaths(id).First(p => p.EndsWith(...))` filtering by exact filename to pick encoder vs decoder (and skip `.onnx_data` files, which don't end in `.onnx`). `SummaryRunner` got a new 2-arg `(encoderPath, decoderPath)` constructor mirroring `WhisperRunner`'s existing (previously unused!) one.

**Real total download size is ~8.9GB, not the previously-documented ~5.7GB** — updated in README/ARCHITECTURE. Whisper alone is ~6.2GB (was estimated 3.1GB) because of the encoder+decoder+external-data split.

**Silero VAD version bug, found via user's reference app** ([[project-owlia-force-push-incident]]-adjacent: unrelated repo, `github.com/biswa6688/speech-detector`, real working app the user already has): our `SileroVadRunner.cs` sent v4-era inputs (`input`,`sr`,`h`,`c` — two separate `[2,1,64]` state tensors). The now-correctly-downloaded model (current `snakers4/silero-vad` master) is **v5** — confirmed via `InferenceSession.InputMetadata` on the actual downloaded file: inputs are `input`(dynamic dims), `sr`(scalar), `state`(**one** tensor, `[2,1,128]`); outputs `output`,`stateN`. Rewrote to match exactly — `state` starts zeroed `float[2*1*128]`, replaced by `stateN` each chunk; also added the 64-sample rolling context window (prepended to each 512-sample chunk → 576-sample `input`) per the reference app's documented behavior (`CHUNK_SAMPLES=512`, `context lookback=64`, `threshold=0.5`, 16kHz). **Verified functionally** (not just compiled): fed synthetic silence and random-noise chunks through the real model — silence → ~0.005 probability, noise → ~0.02-0.06, both correctly far below the 0.5 threshold, no exceptions, state evolves smoothly. No real speech sample was available to test the positive case, but the negative-case behavior and clean plumbing give high confidence.

**New feature: speech percentage.** `SummaryResult.SpeechPercentage` / `SummaryEntity.SpeechPercentage` (double, 0-100) = `Math.Round(sum(vadSegment durations) / totalSec * 100, 1)`, computed in `TranscriptService.cs` step 8 from the VAD segments already in the pipeline (no new model/dependency — VAD's whole job is separating speech from silence/noise, so this is a direct byproduct). EF migration `AddSpeechPercentage` added. Frontend (`SummaryResult` type in `api/client.ts`, `SummaryView.tsx` display) **not yet updated** — backend-only so far, was mid-edit by the other concurrent session and touching it risked collision; revisit.

**Window branding fixed** (user reported: still default icon, default color):
- Generated `assets/owlia.ico` (16/24/32/48/64/128/256px, PNG-compressed frames) from `assets/owlia.svg` via a throwaway console app at `C:\Users\Administrator\Desktop\svg2ico` (references `Svg` + `System.Drawing.Common` NuGet — pure C# SVG rasterizer, no external tool needed since ImageMagick/Inkscape/rsvg-convert aren't installed here). **Note:** `System.Drawing.Icon.ToBitmap()` renders this file as garbage/noise when previewed — that's a known GDI+ limitation decoding PNG-compressed ICO frames, NOT a bad file. Verified correct by extracting the raw embedded PNG bytes directly (manual ICONDIRENTRY offset parsing) and viewing those — correct owl at every size. Don't be fooled by `Icon.ToBitmap()` again; if re-verifying, extract raw frame bytes instead.
- `Owlia.Host.csproj`: added `<ApplicationIcon>` (exe icon) + `<None Include="...\assets\owlia.ico" ... Link="owlia.ico">` (copied next to exe for Photino to load at runtime, same pattern as `log4net.config`/`models.json`).
- `Program.cs`: `window.SetIconFile(iconPath)` before `.Load()`. Title bar color has **no cross-platform Photino API** (verified exhaustively via DLL string extraction — no Color/Background/Theme/TitleBar methods exist at all in Photino.NET 4.0.16) — used the real Win32 `DwmSetWindowAttribute` (`dwmapi.dll`, Windows 11 only) with `DWMWA_CAPTION_COLOR`(35)/`DWMWA_TEXT_COLOR`(36)/`DWMWA_USE_IMMERSIVE_DARK_MODE`(20), COLORREF format `0x00BBGGRR` (reversed RGB). **Gotcha**: `window.WindowHandle` throws `ApplicationException("window is not initialized yet")` if read immediately after `.Load()` — the native window isn't created synchronously. Must read it inside the `window.WindowCreated += (_, _) => ...` event handler, registered *before* `.Load()` is called.
- `setup/owlia-setup.iss`: added `SetupIconFile=..\assets\owlia.ico` + `UninstallDisplayIcon={app}\{#MyAppExeName}` (shortcuts don't need explicit `IconFilename` — they inherit the exe's now-embedded icon resource automatically).
- All 3 pieces screenshot-verified together in one running window: dark mahogany title bar, owl icon top-left, light title text.

**Engine-swap plan agreed with user** (not yet implemented — next major work):
1. **Whisper → Whisper.net** (`Whisper.net`+`Whisper.net.Runtime` NuGet, whisper.cpp/GGML bindings, confirmed real on nuget.org v1.9.1). Reason: real KV-cache decoding built into whisper.cpp instead of the recompute-from-scratch workaround above; GGUF quantized models are smaller/lower-RAM than fp32 ONNX.
2. **VAD + diarization → sherpa-onnx** (`org.k2fsa.sherpa.onnx` NuGet, k2-fsa, v1.13.5 confirmed on nuget.org). Replaces `SileroVadRunner`, `EmbeddingRunner`, `SegmentationRunner`, and the hand-rolled `SpeakerClusterer.cs` (agglomerative clustering, never independently verified) with one tested toolkit. Also has Kokoro TTS support — user said "use whichever is best offline" for TTS, decided to consolidate onto sherpa-onnx's Kokoro module too rather than add a 4th separate dependency (kokoro-onnx / kokoro.cpp are alternatives but sherpa-onnx is already coming in for VAD+diarization).
3. **Summarization → small local LLM via LLamaSharp** (SciSharp/LLamaSharp, llama.cpp binding, GGUF). Reason: current `SummaryRunner` tokenizer is a placeholder char-mapping hack, not real BART BPE — a small instruct model (e.g. Qwen2.5-1.5B-Instruct GGUF) with llama.cpp's correct decoding would beat it, and can generate keywords/takeaways via prompting instead of frequency counting. User confirmed this is fully offline (llama.cpp has zero network dependency) before agreeing.

This is a genuinely large follow-up: 3 new NuGet runtimes, new model downloads for each, rewiring `TranscriptService.cs`'s whole pipeline, retiring `WhisperRunner`/`SileroVadRunner`/`EmbeddingRunner`/`SegmentationRunner`/`SpeakerClusterer`/`SummaryRunner`, manifest changes again. Sequence it as its own set of backlog items rather than assuming it's done — it isn't yet.

---

## Key Decisions

| Decision | Rationale |
|---|---|
| `IPipelineNotifier` | Breaks circular dep Owlia.AI ↔ Owlia.Host |
| NAudio Span API | NAudio 3.x changed signature from `(float[], int, int)` to `Span<float>` |
| Canvas WebAudio visualizer | Direct Web Audio API — no WaveSurfer.js dependency needed |
| `ModelGate` component | Wraps any UI section; reads `modelStore` — one place to change gating logic |
| `modelStore` singleton | Loaded once on app start; refreshed after analysis completes |
| `playgroundStore.reset()` called on new file | Revokes ObjectURL, clears all analysis state |
| Session restore on Playground mount | If `sessionId` set but `segments.length === 0`, fetches all data from API |
| CLI context cached per sessionId | `_contextCache` dict — no re-read per query; temp file written once |
| InnoSetup no models | Models are ~5.7 GB — always downloaded at runtime |
| `build.ps1` `-SkipInstaller` | Allows building without InnoSetup installed |
| `[STAThread]` explicit `Main`, no top-level statements | WebView2 requires an STA window-creating thread; top-level statements can't carry the attribute. Missing it caused a silent blank-white window (native chrome rendered, WebView2 child process never spawned, no exception) |
| `Owlia:Port` config key drives Kestrel binding in both dev and prod | Was previously hardcoded 5174 (dev, via appsettings Kestrel:Endpoints) vs. random 0 (prod, via UseUrls) with a branch on `IsDevelopment()`. Unified into one config-driven value so the port is actually configurable per user's request |
