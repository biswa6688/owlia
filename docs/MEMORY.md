# OWLIA AI Context Memory

This file preserves full project context so AI models do not need to re-read the entire codebase each session. Update sections as features are implemented.

---

## Project Identity

- **Name**: OWLIA — Offline Voice & Language Intelligence Analytics
- **Type**: Desktop app (Photino.NET = native window + embedded Chromium)
- **Platform**: Windows 10/11 x64
- **Repo**: https://github.com/biswa6688/owlia.git
- **Brand icon**: `assets/owlia.svg` (owl, mahogany/amber/gold palette)

---

## Architecture Summary

Single executable (.exe) that:
1. Launches Photino.NET window
2. Starts ASP.NET Core Minimal API on a random local port
3. Serves built React app from `wwwroot/`
4. Communicates via HTTP + SignalR (localhost only)

---

## Color Palette

```
#6e4f44  primary (dark mahogany brown)
#875d54  primary-mid
#d0805f  copper
#f2a35b  amber (main accent)
#feb903  gold (highlight)
#f5dbb8  warm-light (light backgrounds)
#303232  near-black
#878787  gray
```

Dark mode: bg `#1a1210`, surface `#2a1f1b`
Light mode: bg `#fef9f4`, surface `#fff5eb`

---

## C# Projects

| Project | Description | Key Dependencies |
|---|---|---|
| `Owlia.Host` | Executable. Photino window. Minimal API. SignalR hub. | Photino.NET, AspNetCore, SignalR, log4net, Newtonsoft.Json |
| `Owlia.Core` | Interfaces + domain models. No external deps. | — |
| `Owlia.Data` | SQLite via EF Core. Repositories. | EFCore.Sqlite, EFCore.Design |
| `Owlia.AI` | ONNX runners. Audio processing. | OnnxRuntime, NAudio |

---

## React Frontend

- **Framework**: React 18 + TypeScript + Vite
- **State**: Zustand
- **Routing**: React Router v6
- **Styling**: Tailwind CSS
- **Animation**: Framer Motion
- **Icons**: Lucide React
- **Audio viz**: WaveSurfer.js
- **Real-time**: @microsoft/signalr

### Pages
- `/` → FlashScreen (5s auto-redirect)
- `/landing` → Landing (product showcase)
- `/playground` → Playground (media player + AI results)
- `/history` → History (past sessions)
- `/download` → Download (model + CLI management)

---

## AI Models (ONNX)

All stored in `models/` directory. Manifest at `models/models.json`.

| ID | File | Purpose | ~Size |
|---|---|---|---|
| `silero-vad` | `silero_vad.onnx` | VAD | 2MB |
| `whisper-large-v3` | `whisper-large-v3.onnx` | ASR + timestamps | 3.1GB |
| `pyannote-seg` | `pyannote-seg-3.0.onnx` | Speaker segmentation | 80MB |
| `wespeaker-ecapa` | `wespeaker-ecapa-tdnn.onnx` | Speaker embedding | 90MB |
| `roberta-sentiment` | `roberta-sentiment.onnx` | Sentiment 0-100 | 500MB |
| `bart-cnn` | `bart-large-cnn.onnx` | Summarization | 1.6GB |
| `kokoro-tts` | `kokoro-v1.0.onnx` | TTS | 300MB |

---

## Database (SQLite)

File: `data/owlia.db`

```
Sessions   (Id, FileName, Duration, FilePath, CreatedAt)
Segments   (Id, SessionId, Speaker, StartMs, EndMs, Text, SentimentScore, SentimentLabel, Confidence)
Summaries  (Id, SessionId, SummaryText, Keywords JSON, KeyTakeaways JSON, CreatedAt)
```

---

## API Surface

```
POST   /api/media/analyze          → { sessionId }
GET    /api/transcript/{id}        → SpeakerSegment[]
GET    /api/sentiment/{id}         → SentimentResult
GET    /api/summary/{id}           → SummaryResult
GET    /api/models                 → ModelStatus[]
POST   /api/models/download        → start download (progress via SignalR)
GET    /api/history                → Session[]
DELETE /api/history/{id}
POST   /api/tts                    → audio stream
GET    /api/cli/status             → { claude: bool, opencode: bool }
POST   /api/cli/query              → stream CLI response via SignalR

WS     /hub/progress               ← all streaming events
```

### SignalR Events
- `ModelDownloadProgress` → `{ modelId, percent, bytesDownloaded, totalBytes }`
- `TranscriptSegment` → SpeakerSegment (streaming)
- `AnalysisProgress` → `{ stage, percent }` (vad/asr/diarize/sentiment/summary)
- `AnalysisComplete` → `{ sessionId }`
- `CliResponse` → `{ chunk }`

---

## Media Player UI

Full-viewport player. Controls bottom bar (VLC-style):
- Left: play/pause, ±10s skip, speed selector
- Center: time / seek bar / duration
- Right: volume, subtitle toggle, fullscreen

Subtitle overlay: bottom center, semi-transparent bg, current segment text.

Media list: sidebar or overlay panel — add files, drag onto player.

Voice spectrum: canvas WebAudio API visualizer above controls.

---

## Transcript Tab

- List of `SpeakerSegment` items
- Each row: speaker color badge | timestamp | text | sentiment emoji icon
- Active segment (current playback time) highlighted: amber border + tinted bg
- Click row → seek player to segment start
- Auto-scroll to active row

---

## Sentiment Tab

- Per-speaker card:
  - Speaker name + overall score
  - Progress bar gradient: 0-40 red, 41-60 yellow, 61-100 green
- Sentence timeline: horizontal bar, each segment a colored block proportional to duration

---

## Summary Tab

- Summary paragraph
- Keywords: pill badges
- Key takeaways: numbered list

---

## CLI Integration

- Detect `claude` and `opencode` in PATH (via `where` on Windows)
- UI: CLI selector dropdown + status indicator
- If not found: show download links for each
- Context: serialize session to JSON → write temp file → pass `--file` to CLI
- Cache temp file path per sessionId → no re-read
- Stream CLI stdout → SignalR `CliResponse` → frontend chat display

---

## InnoSetup Distribution

Script: `setup/owlia-setup.iss`
- Bundles: .NET 10 runtime check, app files, ffmpeg.exe, VC++ redist
- Does NOT bundle models (8GB → downloaded at runtime)
- Creates Start Menu shortcut + optional Desktop shortcut
- Uninstaller included

---

## Backlog Status

See `docs/BACKLOG.md` for full task list.

Current: BL-001 through BL-007 complete, plus BL-110/BL-111/BL-112 (theme system) done early since it was trivial alongside the frontend scaffold. `Owlia.Host` runs end-to-end: log4net initializes, EF Core migrates SQLite, Kestrel binds a random localhost port, Photino window loads the REAL built React app (`npm run build` → `src/Owlia.Host/wwwroot/` → served, verified via `curl`). Smoke-tested twice via `dotnet run` — confirmed working, process killed after each test.
Next: BL-008 (first commit + push to GitHub `biswa6688/owlia`). After that, Epic 5 (Flash screen animation polish — current stub has the 5s auto-nav but no owl glow/letter-reveal animation yet).

### Frontend scaffold (Owlia.Web) — BL-004 detail
- Vite config: `build.outDir` set to `../Owlia.Host/wwwroot`, `emptyOutDir: true` — `npm run build` from `src/Owlia.Web` drops straight into the host's static folder, no copy step needed.
- Tailwind v4 via `@tailwindcss/vite` plugin — CSS-first config, no `tailwind.config.js`. Owl palette defined as `@theme` tokens (`--color-owl-*`) in `src/index.css`, plus semantic `--bg`/`--surface`/`--text`/`--accent` vars that swap for dark mode.
- Theme: `useThemeStore` (Zustand, `src/store/themeStore.ts`) persists `light`/`dark`/`system` to `localStorage` key `owlia-theme`; applies via `data-theme` attribute on `<html>`. `system` removes the attribute and lets the `prefers-color-scheme` media query in `index.css` take over.
- Router: `react-router-dom` `BrowserRouter` in `App.tsx`, 5 routes matching the 5 pages (`/`, `/landing`, `/playground`, `/history`, `/download`). All pages beyond Flash are placeholder stubs — real implementation is Epics 6-11.
- Brand icon copied to `src/Owlia.Web/public/owlia.svg` (same file as `assets/owlia.svg`, used as favicon + in-app logo).
- `src/Owlia.Host/wwwroot/` is gitignored (generated) — never hand-edit or commit it; always regenerate via `npm run build`.

Note: SDK installed is .NET 10 (10.0.301) only, not .NET 9 — all projects target `net10.0`. Solution file is `owlia.slnx` (new .NET 10 XML sln format), not `.sln`.

### Runtime conventions (Owlia.Host/Program.cs)
- Photino.NET namespace is `Photino.NET` (NOT `PhotinoNET` — verified by inspecting the DLL, don't assume).
- `log4net.config` copied to output dir via `<None CopyToOutputDirectory="PreserveNewest">`; loaded explicitly via `XmlConfigurator.Configure(LogManager.GetRepository(Assembly.GetExecutingAssembly()), new FileInfo(...))` — no `[assembly: XmlConfigurator]` auto-load in .NET Core.
- Logs write to `logs/owlia.log` **relative to `AppContext.BaseDirectory`** (next to the exe) — NOT the repo-root `logs/` folder. Same convention applies to `data/owlia.db`. This is consistent between dev (`bin/Debug/net10.0/`) and published builds (next to the installed exe).
- DbContext class is `OwliaDbContext` (note: earlier ARCHITECTURE.md draft had a typo `OwniaDbContext` — corrected).
- Kestrel binds `http://127.0.0.1:0` (OS-assigned random port); actual URL read back via `IServerAddressesFeature` after `app.RunAsync()`, then passed to `PhotinoWindow.Load(url)`.
- EF migrations live in `src/Owlia.Data/Migrations/`; design-time factory is `OwliaDbContextFactory` (`IDesignTimeDbContextFactory<OwliaDbContext>`) so `dotnet ef migrations add` works without needing Owlia.Host DI wired up.
- `dotnet-ef` installed as global tool (not on PATH this session — invoke via `C:\Users\Administrator\.dotnet\tools\dotnet-ef.exe` or add `~/.dotnet/tools` to PATH).

---

## Key Decisions

| Decision | Rationale |
|---|---|
| Photino.NET over Electron | ~5MB overhead vs ~150MB; no Node.js runtime; native window |
| ONNX Runtime over Python | Single .NET process; no Python dep; predictable memory |
| Whisper large-v3 | Best accuracy; fits 36GB RAM budget |
| SQLite not SQL Server | Zero config; portable; sufficient for local single-user app |
| Zustand not Redux | Simpler API; less boilerplate; sufficient for this app |
| SignalR not WebSocket raw | Built-in reconnect; typed events; easy .NET integration |
| ffmpeg bundled | Universal audio/video support without NAudio codec limitations |
