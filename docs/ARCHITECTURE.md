# OWLIA Architecture

**OWLIA — Offline Voice & Language Intelligence Analytics**

## Stack

| Layer | Technology |
|---|---|
| Host | C# .NET 10, Photino.NET (native window + embedded Chromium) |
| API | ASP.NET Core Minimal API (in-process with Photino) |
| Real-time | SignalR (progress streaming, transcript streaming) |
| Data | SQLite via EF Core 10 |
| Logging | Log4Net |
| Serialization | Newtonsoft.Json (Json.NET) |
| AI Runtime | Microsoft.ML.OnnxRuntime 1.20+ |
| Frontend | React 18, TypeScript, Vite, Zustand, Tailwind CSS |
| Packaging | InnoSetup 6 |

---

## Brand Colors (Owl Palette)

```
--color-primary:        #6e4f44   /* dark mahogany brown */
--color-primary-mid:    #875d54   /* medium brown */
--color-copper:         #d0805f   /* copper */
--color-amber:          #f2a35b   /* amber/orange accent */
--color-gold:           #feb903   /* gold highlight */
--color-warm-light:     #f5dbb8   /* warm peach (light bg) */
--color-near-black:     #303232   /* near black */
--color-gray:           #878787   /* neutral gray */

Dark mode bg:           #1a1210
Dark mode surface:      #2a1f1b
Light mode bg:          #fef9f4
Light mode surface:     #fff5eb
```

---

## Project Structure

```
owlia/
├── src/
│   ├── Owlia.Host/              # Executable — Photino window + Minimal API
│   │   ├── Program.cs
│   │   ├── Api/
│   │   │   ├── MediaApi.cs      # POST /api/media (analyze)
│   │   │   ├── TranscriptApi.cs # GET /api/transcript/{id}
│   │   │   ├── ModelApi.cs      # GET/POST /api/models
│   │   │   ├── HistoryApi.cs    # GET /api/history
│   │   │   ├── TtsApi.cs        # POST /api/tts
│   │   │   └── CliApi.cs        # GET/POST /api/cli
│   │   ├── Hubs/
│   │   │   └── ProgressHub.cs   # SignalR: progress + transcript streaming
│   │   └── wwwroot/             # Built React app (vite build output)
│   │
│   ├── Owlia.Core/              # Domain models + service interfaces
│   │   ├── Services/
│   │   │   ├── ITranscriptService.cs
│   │   │   ├── ISentimentService.cs
│   │   │   ├── ISummaryService.cs
│   │   │   ├── ITtsService.cs
│   │   │   └── IModelManagerService.cs
│   │   └── Models/
│   │       ├── TranscriptResult.cs
│   │       ├── SpeakerSegment.cs   # { Speaker, Start, End, Text, Confidence }
│   │       ├── SentimentResult.cs  # { Score 0-100, Label, Segments[] }
│   │       └── SummaryResult.cs    # { Summary, Keywords[], KeyTakeaways[] }
│   │
│   ├── Owlia.Data/              # EF Core, SQLite, repositories
│   │   ├── OwliaDbContext.cs
│   │   ├── Entities/
│   │   │   ├── SessionEntity.cs    # { Id, FileName, Duration, CreatedAt }
│   │   │   ├── SegmentEntity.cs    # { Id, SessionId, Speaker, Start, End, Text, Sentiment }
│   │   │   └── SummaryEntity.cs
│   │   └── Repositories/
│   │       ├── ISessionRepository.cs
│   │       └── SessionRepository.cs
│   │
│   ├── Owlia.AI/                # ONNX runners (stateless, thread-safe)
│   │   ├── ModelManager.cs      # Download, validate, cache paths
│   │   ├── Vad/
│   │   │   └── SileroVadRunner.cs
│   │   ├── Asr/
│   │   │   └── WhisperRunner.cs     # Whisper large-v3 ONNX
│   │   ├── Diarization/
│   │   │   ├── SegmentationRunner.cs    # pyannote segmentation-3.0 ONNX
│   │   │   └── EmbeddingRunner.cs       # WeSpeaker ECAPA-TDNN ONNX
│   │   ├── Sentiment/
│   │   │   └── SentimentRunner.cs   # RoBERTa sentiment ONNX
│   │   ├── Summary/
│   │   │   └── SummaryRunner.cs     # BART-CNN ONNX
│   │   └── Tts/
│   │       └── KokoroRunner.cs      # Kokoro TTS ONNX
│   │
│   └── Owlia.Web/               # React TypeScript frontend
│       ├── src/
│       │   ├── pages/
│       │   │   ├── Flash/           # 5s animated intro
│       │   │   ├── Landing/         # Product showcase
│       │   │   ├── Playground/      # Main tool
│       │   │   ├── History/         # Past sessions
│       │   │   └── Download/        # Model management
│       │   ├── components/
│       │   │   ├── MediaPlayer/     # Full-screen player + controls + subtitles
│       │   │   ├── Transcript/      # Synchronized highlighted transcript
│       │   │   ├── Sentiment/       # Speaker progress bars
│       │   │   ├── Summary/         # Summary + keywords + takeaways
│       │   │   ├── VoiceSpectrum/   # Audio visualizer canvas
│       │   │   └── UI/              # Shared: Button, Badge, Progress, Modal
│       │   ├── store/               # Zustand global state
│       │   ├── api/                 # Fetch + SignalR client
│       │   └── theme/               # CSS variables, dark/light/system
│       └── vite.config.ts
│
├── models/                      # ONNX models (downloaded at runtime)
│   └── models.json              # Manifest: name, url, sha256, size
├── data/                        # SQLite DB file
├── logs/                        # Log4Net rolling file
├── assets/
│   └── owlia.svg                # Brand icon
├── docs/
│   ├── README.md
│   ├── ARCHITECTURE.md          # This file
│   ├── MEMORY.md                # AI context memory (no reload needed)
│   ├── CHANGELOG.md
│   └── BACKLOG.md
├── setup/
│   └── owlia-setup.iss          # InnoSetup 6 script
└── owlia.slnx
```

---

## AI Pipeline (Processing Flow)

```
Media File (audio/video)
    │
    ▼
[Audio Extraction]  ffmpeg / NAudio
    │
    ▼
[Silero VAD]        → voice activity segments (start/end times)
    │
    ▼
[Whisper large-v3]  → text + word-level timestamps per segment
    │
    ▼
[Speaker Diarization]
    ├── SegmentationRunner  → speaker change boundaries
    └── EmbeddingRunner     → speaker identity clustering
    │
    ▼
[Merge]             → SpeakerSegment[] { speaker, start, end, text }
    │
    ├──▶ [SentimentRunner]  → per-segment score 0-100
    └──▶ [SummaryRunner]    → summary + keywords + key takeaways
```

---

## ONNX Models

| Model | Purpose | Format | RAM | Source |
|---|---|---|---|---|
| silero_vad.onnx | Voice Activity Detection | ONNX | ~10MB | snakers4/silero-vad |
| whisper-large-v3 | ASR + timestamps | ONNX | ~3.1GB | openai/whisper (optimum export) |
| pyannote-segmentation-3.0 | Speaker segmentation | ONNX | ~80MB | pyannote/segmentation-3.0 |
| wespeaker-ecapa-tdnn | Speaker embedding | ONNX | ~90MB | wenet-e2e/wespeaker |
| roberta-sentiment | Sentiment (0-100) | ONNX | ~500MB | cardiffnlp/twitter-roberta-base-sentiment-latest |
| bart-large-cnn | Summarization | ONNX | ~1.6GB | facebook/bart-large-cnn |
| kokoro-v1.0 | TTS (high quality) | ONNX | ~300MB | kokoro-tts/kokoro |

**Total model RAM: ~5.7GB** — well within 36GB constraint.

---

## Database Schema

```sql
Sessions (Id TEXT PK, FileName TEXT, Duration REAL, FilePath TEXT, CreatedAt TEXT)
Segments (Id TEXT PK, SessionId TEXT FK, Speaker TEXT, StartMs INTEGER, EndMs INTEGER,
          Text TEXT, SentimentScore REAL, SentimentLabel TEXT, Confidence REAL)
Summaries (Id TEXT PK, SessionId TEXT FK, SummaryText TEXT, Keywords TEXT JSON,
           KeyTakeaways TEXT JSON, CreatedAt TEXT)
```

---

## CLI Integration

- Detect `claude` and `opencode` binaries in PATH
- If missing, show download links (claude.ai/download, opencode.ai)
- User selects active CLI
- Context strategy: write session JSON to temp file, pass as `--file` arg
- Context is cached per session ID — re-use without re-reading file

---

## API Endpoints

```
POST   /api/media/analyze          { filePath } → { sessionId }
GET    /api/transcript/{sessionId} → SpeakerSegment[]
GET    /api/sentiment/{sessionId}  → SentimentResult
GET    /api/summary/{sessionId}    → SummaryResult
GET    /api/models                 → ModelStatus[]
POST   /api/models/download        { modelId } → stream progress via SignalR
GET    /api/history                → Session[]
DELETE /api/history/{sessionId}
POST   /api/tts                    { text, voice } → audio stream
GET    /api/cli/status             → { claude: bool, opencode: bool }
POST   /api/cli/query              { sessionId, question, cli } → stream response
WS     /hub/progress               SignalR hub
```

---

## SignalR Events

| Event | Payload |
|---|---|
| `ModelDownloadProgress` | `{ modelId, percent, bytesDownloaded, totalBytes }` |
| `TranscriptSegment` | `SpeakerSegment` (streaming during analysis) |
| `AnalysisProgress` | `{ stage, percent }` (vad/asr/diarization/sentiment/summary) |
| `AnalysisComplete` | `{ sessionId }` |
| `CliResponse` | `{ chunk }` (streaming CLI output) |

---

## Frontend Pages

### Flash Screen (5s)
- Owl logo animation (scale + glow pulse)
- Brand name with letter-by-letter reveal
- Tagline fade in
- Auto-transition to Landing at 5s

### Landing Page
- Hero: full-viewport, animated background, CTA
- Features grid (6 cards, icon + description)
- How It Works: 5-step illustrated pipeline
- FAQ accordion
- CTA footer

### Playground Page
```
┌─────────────────────────────────────────────────────────────────┐
│  [Full-screen Media Player]                                      │
│  [Controls: ← 10s | ⏮ | ⏸ | ⏭ | 10s→]  [speed] [vol] [time] │
│  [Subtitles bar at bottom]           [Fullscreen] [Add Media]   │
├─────────────────────────────────────────────────────────────────┤
│  [Tabs: Transcript | Sentiment | Summary]                        │
│                                                                  │
│  Transcript: scrollable list, highlighted segment = current time │
│  Sentiment:  speaker bars + sentence timeline                    │
│  Summary:    text + keyword badges + takeaway bullets            │
└─────────────────────────────────────────────────────────────────┘
```

### History Page
- Card grid of past sessions
- Click to reopen in Playground

### Download Page
- Model status table (downloaded / pending)
- Per-model download button + progress bar
- Feature unlock display
