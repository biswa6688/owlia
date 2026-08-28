# OWLIA Backlog

Status: `[ ]` todo · `[~]` in-progress · `[x]` done · `[!]` blocked

---

## Epic 1 — Project Foundation

| ID | Task | Notes |
|---|---|---|
| BL-001 | `[x]` Create directory structure + docs | Done |
| BL-002 | `[x]` Create `owlia.slnx` + 4 C# projects | Host, Core, Data, AI — net10.0 (only SDK installed) |
| BL-003 | `[x]` Add NuGet packages to each project | Done — see packages below |
| BL-004 | `[x]` Create React+TypeScript frontend (Vite) | `Owlia.Web` — router, 5 page stubs, theme store (light/dark/system), Tailwind v4, `npm run build` verified end-to-end |
| BL-005 | `[x]` Configure Photino.NET to serve built React | `wwwroot` static serving wired; empty until BL-004 builds + copies `dist/` |
| BL-006 | `[x]` Set up Log4Net with rolling file appender | `logs/owlia.log` next to exe (`AppContext.BaseDirectory`), console appender too |
| BL-007 | `[x]` Set up SQLite + EF Core, DbContext, migrations | `data/owlia.db` next to exe; `InitialCreate` migration verified — tables created on startup |
| BL-008 | `[ ]` Git init, .gitignore, push to GitHub | `biswa6688/owlia` — repo/.git present, not yet committed |

**NuGet packages:**
- `Owlia.Host`: `Photino.NET`, `Microsoft.AspNetCore`, `Microsoft.AspNetCore.SignalR`, `log4net`, `Newtonsoft.Json`
- `Owlia.Data`: `Microsoft.EntityFrameworkCore.Sqlite`, `Microsoft.EntityFrameworkCore.Design`
- `Owlia.AI`: `Microsoft.ML.OnnxRuntime`, `NAudio`, `SixLabors.ImageSharp` (audio processing)
- `Owlia.Core`: no external deps

**npm packages (Owlia.Web):**
- `react`, `react-dom`, `react-router-dom`, `zustand`
- `@microsoft/signalr`, `axios`
- `tailwindcss`, `@tailwindcss/vite`
- `framer-motion` (animations)
- `lucide-react` (icons)
- `wavesurfer.js` (audio visualizer / waveform)
- `@radix-ui/react-*` (accessible UI primitives)

---

## Epic 2 — ONNX Model Management

| ID | Task | Notes |
|---|---|---|
| BL-010 | `[ ]` Write `models/models.json` manifest | id, url, sha256, sizeBytes, feature |
| BL-011 | `[ ]` `ModelManager.cs` — download with progress, SHA256 validate | Emit SignalR events |
| BL-012 | `[ ]` `ModelApi.cs` — GET `/api/models`, POST `/api/models/download` | |
| BL-013 | `[ ]` Download Page UI — model status table + per-model progress bar | |
| BL-014 | `[ ]` Feature gating — disable Playground tabs until required models ready | |

---

## Epic 3 — AI Pipeline (Backend)

| ID | Task | Notes |
|---|---|---|
| BL-020 | `[ ]` `SileroVadRunner.cs` — load silero_vad.onnx, run on audio float[] | Returns `VadSegment[]` |
| BL-021 | `[ ]` `WhisperRunner.cs` — load whisper-large-v3 ONNX, transcribe with timestamps | Returns `WhisperSegment[]` |
| BL-022 | `[ ]` `SegmentationRunner.cs` — pyannote seg ONNX → speaker turn boundaries | |
| BL-023 | `[ ]` `EmbeddingRunner.cs` — ECAPA-TDNN ONNX → 256-dim speaker vectors | |
| BL-024 | `[ ]` Diarization pipeline — cluster embeddings (k-means/agglomerative) → speaker labels | |
| BL-025 | `[ ]` `SentimentRunner.cs` — RoBERTa ONNX → score 0-100 per segment | Map logits to 0-100 |
| BL-026 | `[ ]` `SummaryRunner.cs` — BART ONNX → summary text + extract keywords | |
| BL-027 | `[ ]` `KokoroRunner.cs` — Kokoro TTS ONNX → PCM audio bytes | |
| BL-028 | `[ ]` Audio extraction helper — use ffmpeg (bundled) to extract PCM from any media | |
| BL-029 | `[ ]` `TranscriptService.cs` — orchestrate full pipeline, emit SignalR progress | |

---

## Epic 4 — Backend API

| ID | Task | Notes |
|---|---|---|
| BL-030 | `[ ]` `MediaApi.cs` — `POST /api/media/analyze` → queue job, return sessionId | |
| BL-031 | `[ ]` `TranscriptApi.cs` — `GET /api/transcript/{id}`, `GET /api/sentiment/{id}`, `GET /api/summary/{id}` | |
| BL-032 | `[ ]` `HistoryApi.cs` — `GET /api/history`, `DELETE /api/history/{id}` | |
| BL-033 | `[ ]` `TtsApi.cs` — `POST /api/tts` → stream audio | |
| BL-034 | `[ ]` `CliApi.cs` — `GET /api/cli/status`, `POST /api/cli/query` | |
| BL-035 | `[ ]` `ProgressHub.cs` — SignalR hub for all streaming | |

---

## Epic 5 — Flash Screen

| ID | Task | Notes |
|---|---|---|
| BL-040 | `[ ]` Owl SVG animation (scale-in + glow pulse, 1s) | CSS/Framer Motion |
| BL-041 | `[ ]` Brand name letter-by-letter reveal (1.5s) | |
| BL-042 | `[ ]` Tagline fade in (0.5s) | |
| BL-043 | `[x]` Auto-navigate to Landing at 5s | `FlashScreen.tsx` — `setTimeout` + `navigate('/landing')`; static (no animation yet) |

---

## Epic 6 — Landing Page

| ID | Task | Notes |
|---|---|---|
| BL-050 | `[ ]` Hero section — full viewport, animated particle/wave bg, CTA button | |
| BL-051 | `[ ]` Features grid — 6 cards: ASR, Diarization, Sentiment, Summary, TTS, CLI | Icons + short copy |
| BL-052 | `[ ]` How It Works — 5-step horizontal pipeline illustration | |
| BL-053 | `[ ]` FAQ accordion — 6 common questions | |
| BL-054 | `[ ]` Navigation header — logo, page links, theme toggle | |
| BL-055 | `[ ]` CTA footer | |

---

## Epic 7 — Media Player

| ID | Task | Notes |
|---|---|---|
| BL-060 | `[ ]` Full-viewport player (video + audio waveform fallback) | HTML5 video + canvas |
| BL-061 | `[ ]` Controls bar: play/pause, seek, ±10s skip, speed (0.5–3×), volume, time display | |
| BL-062 | `[ ]` Subtitle overlay at bottom (VLC-style) — current segment text | |
| BL-063 | `[ ]` Fullscreen / exit fullscreen toggle | Fullscreen API |
| BL-064 | `[ ]` Media list sidebar — add files, drag to player | |
| BL-065 | `[ ]` Drag media file onto player to load | HTML5 drag-drop |
| BL-066 | `[ ]` Voice spectrum visualizer (canvas WebAudio API) | WaveSurfer.js or custom |

---

## Epic 8 — Playground Transcript Tab

| ID | Task | Notes |
|---|---|---|
| BL-070 | `[ ]` Segment list: speaker badge + timestamp + text + sentiment icon | |
| BL-071 | `[ ]` Auto-scroll to current segment during playback | `scrollIntoView` |
| BL-072 | `[ ]` Click segment → seek player to that timestamp | |
| BL-073 | `[ ]` Highlight active segment (amber border + background) | |
| BL-074 | `[ ]` Speaker color coding (each speaker gets unique hue) | |

---

## Epic 9 — Playground Sentiment Tab

| ID | Task | Notes |
|---|---|---|
| BL-080 | `[ ]` Speaker cards with overall sentiment progress bar | Gradient 0-100 |
| BL-081 | `[ ]` Color: 0-40 red, 41-60 yellow, 61-100 green (smooth gradient) | CSS gradient |
| BL-082 | `[ ]` Sentence timeline — horizontal bar with colored segments per speaker | |

---

## Epic 10 — Playground Summary Tab

| ID | Task | Notes |
|---|---|---|
| BL-090 | `[ ]` Summary text block | |
| BL-091 | `[ ]` Keywords — pill/badge cloud | |
| BL-092 | `[ ]` Key takeaways — numbered bullet list | |

---

## Epic 11 — History Page

| ID | Task | Notes |
|---|---|---|
| BL-100 | `[ ]` Session grid cards — filename, duration, date, speaker count | |
| BL-101 | `[ ]` Click card → open session in Playground | Pass sessionId via router |
| BL-102 | `[ ]` Delete session with confirmation | |

---

## Epic 12 — Theme System

| ID | Task | Notes |
|---|---|---|
| BL-110 | `[x]` CSS custom property design tokens (owl palette) | dark + light sets — `src/index.css` |
| BL-111 | `[x]` System theme auto-detection (`prefers-color-scheme`) | `:root:not([data-theme])` media query fallback |
| BL-112 | `[x]` Theme toggle component (sun/moon/system icons) | `ThemeToggle.tsx`, Zustand store persisted in localStorage |

---

## Epic 13 — CLI Integration

| ID | Task | Notes |
|---|---|---|
| BL-120 | `[ ]` `CliApi.cs` detect claude + opencode in PATH | `which` / `where` |
| BL-121 | `[ ]` CLI selector UI (dropdown: Claude / OpenCode / None) | |
| BL-122 | `[ ]` Download links UI if CLI not found | |
| BL-123 | `[ ]` Context manager — write session JSON to temp, cache path per sessionId | No re-read |
| BL-124 | `[ ]` Query UI — text input → stream CLI response | SignalR |

---

## Epic 14 — Distribution

| ID | Task | Notes |
|---|---|---|
| BL-130 | `[ ]` `owlia-setup.iss` InnoSetup 6 script | Bundle ffmpeg, no models (downloaded at runtime) |
| BL-131 | `[ ]` Build script — `dotnet publish` + `vite build` → copy to `wwwroot` | |
| BL-132 | `[ ]` Sign executable (optional, self-signed for now) | |

---

## Execution Order (recommended)

```
BL-002 → BL-003 → BL-007 → BL-006 → BL-004 → BL-005 → BL-008
    ↓
BL-010 → BL-011 → BL-013 → BL-014
    ↓
BL-020 → BL-021 → BL-022 → BL-023 → BL-024 → BL-025 → BL-026 → BL-027 → BL-028 → BL-029
    ↓
BL-030..035
    ↓
BL-110..112  (theme first, all UI builds on it)
    ↓
BL-040..043  (flash)
BL-050..055  (landing)
BL-060..066  (player)
BL-070..074  (transcript tab)
BL-080..082  (sentiment tab)
BL-090..092  (summary tab)
BL-100..102  (history)
BL-120..124  (CLI)
    ↓
BL-130..132  (distribution)
```
