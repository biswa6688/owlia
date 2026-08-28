# Changelog

All notable changes to OWLIA are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) — Semantic Versioning.

---

## [Unreleased]

### Added
- Project scaffolding: directory structure, solution layout
- Documentation: README (root + docs), ARCHITECTURE, MEMORY, BACKLOG, CHANGELOG
- Brand assets: `assets/owlia.svg` (owl icon)
- `.gitignore` for .NET + Node + ONNX models
- `owlia.slnx` solution with 4 C# projects (`Owlia.Host`, `Owlia.Core`, `Owlia.Data`, `Owlia.AI`), target `net10.0`
- NuGet packages: Photino.NET, log4net, Newtonsoft.Json, EF Core Sqlite/Design, Microsoft.ML.OnnxRuntime, NAudio
- `Owlia.Core`: domain models (`Session`, `SpeakerSegment`, `TranscriptResult`, `SentimentResult`, `SummaryResult`, `ModelStatus`) + service interfaces
- `Owlia.Data`: EF Core `OwliaDbContext`, entities, `SessionRepository`, initial migration (`InitialCreate`)
- `Owlia.Host`: log4net rolling file appender, Photino window host, ASP.NET Core Minimal API on random localhost port, static file serving, `/api/health` endpoint — verified end-to-end via `dotnet run`
- `Owlia.Web`: React 18 + TypeScript + Vite frontend, Tailwind v4, React Router (5 pages), Zustand theme store (light/dark/system), builds directly into `Owlia.Host/wwwroot`

---

## Planned Releases

### [0.1.0] — Foundation
- Solution structure (Owlia.Host, Core, Data, AI)
- Photino.NET window host
- SQLite + EF Core setup
- React + Vite frontend scaffold
- Log4Net logging
- ONNX model download + validation system

### [0.2.0] — AI Pipeline
- Silero VAD runner
- Whisper large-v3 ASR runner (with word timestamps)
- Speaker diarization (pyannote + WeSpeaker)
- Sentiment analysis runner (RoBERTa)
- Summarization runner (BART-CNN)

### [0.3.0] — UI Core
- Flash screen (5s animated intro)
- Landing page (features, how-it-works, FAQ)
- Theme system (dark/light/system, owl palette)

### [0.4.0] — Playground
- Full-screen media player (VLC-style controls, subtitle overlay)
- Transcript tab (synchronized, highlighted, speaker colors)
- Sentiment tab (progress bars, sentence timeline)
- Summary tab (text, keywords, takeaways)

### [0.5.0] — History + CLI
- History page (session cards, delete)
- Claude CLI + OpenCode CLI integration
- CLI context caching (no re-read per query)

### [0.6.0] — TTS + Distribution
- Kokoro TTS runner
- InnoSetup installer
- Build pipeline script

### [1.0.0] — Release
- All features complete + tested
- Signed installer
