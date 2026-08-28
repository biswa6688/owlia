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
- Kestrel `http://127.0.0.1:0` — random port read back via `IServerAddressesFeature`
- NAudio 3.x: `ISampleProvider.Read(Span<float>)` (not 3-arg array)
- `dotnet-ef` tool: `C:\Users\Administrator\.dotnet\tools\dotnet-ef.exe`
- All projects target `net10.0`; solution `owlia.slnx`

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

**Next action**: Download models via Download page → drop an audio file in Playground → click Analyse → verify full pipeline.

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
