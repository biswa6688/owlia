# OWLIA

**Offline Voice & Language Intelligence Analytics**

A desktop application for offline speech-to-text transcription with speaker diarization, sentiment analysis, summarization, and text-to-speech — all powered by local ONNX models. No internet required after model download.

---

## Features

| Feature | Model | Status |
|---|---|---|
| Speech-to-Text | Whisper large-v3 (ONNX) | Planned |
| Voice Activity Detection | Silero VAD (ONNX) | Planned |
| Speaker Diarization | pyannote seg-3.0 + WeSpeaker (ONNX) | Planned |
| Sentence Sentiment | RoBERTa sentiment (ONNX) | Planned |
| Summarization | BART-large-CNN (ONNX) | Planned |
| Text-to-Speech | Kokoro v1.0 (ONNX) | Planned |
| CLI Integration | Claude CLI / OpenCode CLI | Planned |

---

## Tech Stack

- **Backend**: C# .NET 10, Photino.NET, ASP.NET Core Minimal API, SignalR
- **Data**: SQLite + EF Core
- **Logging**: Log4Net
- **Serialization**: Newtonsoft.Json
- **AI Runtime**: Microsoft.ML.OnnxRuntime 1.20+
- **Frontend**: React 18, TypeScript, Vite, Zustand, Tailwind CSS, Framer Motion
- **Distribution**: InnoSetup 6

---

## System Requirements

- Windows 10/11 x64
- RAM: 8GB minimum, 16GB recommended (36GB for all models simultaneously)
- Storage: ~8GB for all ONNX models
- .NET 10 Runtime (bundled in installer)

---

## ONNX Models

Models are downloaded on first use. Total size ~8.9GB (revised — Whisper and BART ship as encoder+decoder file pairs, not single merged files; see `docs/MEMORY.md`).

| Model | Files | Size | Purpose |
|---|---|---|---|
| `silero_vad.onnx` | 1 | ~2.3MB | Voice activity detection |
| `whisper-large-v3` | encoder+decoder, each with external `.onnx_data` weights (4 files) | ~6.2GB | Speech-to-text + timestamps |
| `pyannote-seg-3.0.onnx` | 1 | ~5.7MB | Speaker segmentation |
| `wespeaker-ecapa-tdnn.onnx` | 1 | ~23.7MB | Speaker embedding |
| `roberta-sentiment.onnx` | 1 | ~476MB | Sentiment analysis |
| `bart-cnn` | encoder+decoder (2 files) | ~1.7GB | Summarization |
| `kokoro-v1.0.onnx` | 1 | ~310MB | Text-to-speech |

**Planned engine swaps** (see `docs/MEMORY.md` for rationale): Whisper → Whisper.net (whisper.cpp), VAD+diarization → sherpa-onnx, Summarization → a small local LLM via LLamaSharp. Not yet implemented — models above are the current ONNX Runtime versions.

---

## Project Structure

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for full detail.

```
owlia/
├── src/
│   ├── Owlia.Host/      # C# executable (Photino + Minimal API)
│   ├── Owlia.Core/      # Domain models + service interfaces
│   ├── Owlia.Data/      # SQLite repositories
│   ├── Owlia.AI/        # ONNX runners
│   └── Owlia.Web/       # React TypeScript frontend
├── models/              # Downloaded ONNX models
├── docs/                # Documentation
└── setup/               # InnoSetup script
```

---

## Development Setup

### Prerequisites
- .NET 10 SDK
- Node.js 20+
- Visual Studio 2022 or VS Code + C# Dev Kit

### Build

```bash
# Backend
dotnet restore owlia.slnx
dotnet build owlia.slnx

# Frontend
cd src/Owlia.Web
npm install
npm run build

# Run (development)
cd src/Owlia.Host
dotnet run
```

### Publish (release)

```bash
dotnet publish src/Owlia.Host -c Release -r win-x64 --self-contained
cd src/Owlia.Web && npm run build
# Copy dist/ to src/Owlia.Host/wwwroot/
iscc setup/owlia-setup.iss
```

---

## Pages

| Page | Route | Description |
|---|---|---|
| Flash Screen | `/` | 5-second animated intro |
| Landing | `/landing` | Product showcase, features, FAQ |
| Playground | `/playground` | Main tool — media player + transcript |
| History | `/history` | Past transcription sessions |
| Download | `/download` | Model management + CLI download |

---

## CLI Integration

OWLIA can route questions about transcription results to Claude CLI or OpenCode CLI.

1. CLI is detected automatically from PATH
2. User selects preferred CLI in settings
3. Session context is cached — not re-read on each query
4. Streaming response displayed in-app

---

## Brand

- **Icon**: Owl (wisdom + listening)
- **Palette**: Dark mahogany `#6e4f44`, Amber `#f2a35b`, Gold `#feb903`, Copper `#d0805f`
- **Theme**: Dark / Light / System (auto)

---

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — full technical architecture
- [`docs/MEMORY.md`](docs/MEMORY.md) — AI context memory (no full reload needed)
- [`docs/BACKLOG.md`](docs/BACKLOG.md) — task list
- [`docs/CHANGELOG.md`](docs/CHANGELOG.md) — release history

---

## License

MIT
