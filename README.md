# OWLIA

**Offline Voice & Language Intelligence Analytics**

A desktop application for offline speech-to-text transcription with speaker diarization, sentiment analysis, summarization, and text-to-speech — all powered by local ONNX models. No internet required after model download.

---

## Features

| Feature | Model | Status |
|---|---|---|
| Speech-to-Text | Whisper large-v3 (Whisper.net / whisper.cpp) | Planned |
| Voice Activity Detection | Silero VAD (sherpa-onnx) | Planned |
| Speaker Diarization | pyannote seg-3.0 + WeSpeaker (sherpa-onnx) | Planned |
| Sentence Sentiment | RoBERTa sentiment (ONNX) | Planned |
| Summarization | Qwen2.5-1.5B-Instruct (LLamaSharp / llama.cpp) | Planned |
| Text-to-Speech | Kokoro v1.0 (ONNX) | Planned |
| CLI Integration | Claude CLI / OpenCode CLI | Planned |

---

## Tech Stack

- **Backend**: C# .NET 10, Photino.NET, ASP.NET Core Minimal API, SignalR
- **Data**: SQLite + EF Core
- **Logging**: Log4Net
- **Serialization**: Newtonsoft.Json
- **AI Runtime**: ONNX Runtime (sentiment, TTS), Whisper.net/whisper.cpp (ASR), sherpa-onnx (VAD, diarization), LLamaSharp/llama.cpp (summarization)
- **Frontend**: React 18, TypeScript, Vite, Zustand, Tailwind CSS, Framer Motion
- **Distribution**: InnoSetup 6

---

## System Requirements

- Windows 10/11 x64
- RAM: 8GB minimum, 16GB recommended (36GB for all models simultaneously)
- Storage: ~5.1GB for all models
- .NET 10 Runtime (bundled in installer)

---

## Models

Models are downloaded on first use. Total size ~5.1GB.

| Model | Engine | Files | Size | Purpose |
|---|---|---|---|---|
| `silero_vad.onnx` | sherpa-onnx | 1 | ~644KB | Voice activity detection |
| `ggml-large-v3.bin` | Whisper.net (whisper.cpp) | 1 | ~2.9GB | Speech-to-text + timestamps |
| `pyannote-seg-3.0.onnx` | sherpa-onnx | 1 | ~5.7MB | Speaker segmentation |
| `wespeaker_en_voxceleb_resnet34_LM.onnx` | sherpa-onnx | 1 | ~25.3MB | Speaker embedding |
| `roberta-sentiment.onnx` | ONNX Runtime | 1 | ~476MB | Sentiment analysis |
| `qwen2.5-1.5b-instruct-q5_k_m.gguf` | LLamaSharp (llama.cpp) | 1 | ~1.2GB | Summarization |
| `kokoro-v1.0.onnx` | ONNX Runtime | 1 | ~310MB | Text-to-speech |

Diarization (segmentation + embedding + clustering) runs as one sherpa-onnx `OfflineSpeakerDiarization` call rather than 3 separate stages. Summarization, keywords, and takeaways all come from one prompted call to the local LLM.

**All 3 planned engine swaps are done** (Whisper → Whisper.net, VAD+diarization → sherpa-onnx, Summarization → LLamaSharp). TTS → sherpa-onnx's Kokoro module is deferred — its model ships as a directory bundle (`model.onnx` + `voices.bin` + `tokens.txt` + `espeak-ng-data/`) only distributed as a `.tar.bz2` archive, which the current per-file manifest doesn't support yet.

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
