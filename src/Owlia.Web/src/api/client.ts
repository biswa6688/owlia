import axios from 'axios'

// In production the React app is served by Kestrel on the same origin.
// In Vite dev mode we proxy /api to the backend (configure vite.config.ts if needed).
export const api = axios.create({
  baseURL: '/',
  headers: { 'Content-Type': 'application/json' },
})

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ModelStatus {
  id: string
  displayName: string
  fileName: string
  feature: string
  sizeBytes: number
  sha256: string
  url: string
  downloaded: boolean
  verified: boolean
  partialBytes: number
  isPaused: boolean
}

export interface SpeakerSegment {
  id: string
  sessionId: string
  speaker: string
  startMs: number
  endMs: number
  text: string
  confidence: number
  sentimentScore: number
  sentimentLabel: string
}

export interface SpeakerSentiment {
  speaker: string
  overallScore: number
  overallLabel: string
}

export interface SentimentResult {
  sessionId: string
  bySpeaker: SpeakerSentiment[]
  timeline: SpeakerSegment[]
}

export interface SummaryResult {
  sessionId: string
  summary: string
  keywords: string[]
  keyTakeaways: string[]
}

export interface TranscriptResult {
  sessionId: string
  segments: SpeakerSegment[]
}

export interface Session {
  id: string
  fileName: string
  filePath: string
  durationSeconds: number
  speakerCount: number
  createdAt: string
}

export interface CliStatus {
  claude: boolean
  opencode: boolean
  claudeVersion?: string
  opencodeVersion?: string
}

// ── API calls ─────────────────────────────────────────────────────────────────

export const modelsApi = {
  getAll: () => api.get<ModelStatus[]>('/api/models').then(r => r.data),
  download: (modelId: string) => api.post('/api/models/download', { modelId }),
  pause: (modelId: string) => api.post('/api/models/pause', { modelId }),
  cancel: (modelId: string) => api.post('/api/models/cancel', { modelId }),
}

export interface CliUpdateInfo {
  slug: string
  installedVersion: string | null
  latestVersion: string | null
  updateAvailable: boolean
}

export interface ModelUpdateInfo {
  id: string
  updateAvailable: boolean
  checked: boolean
}

export const updatesApi = {
  check: () => api.get<{ cli: CliUpdateInfo[]; models: ModelUpdateInfo[] }>('/api/updates/check').then(r => r.data),
}

export const mediaApi = {
  // Browsers never expose a real filesystem path for a File object (neither
  // from a file input nor drag-and-drop) — upload the bytes and get back the
  // server-side path that /api/media/analyze can actually read.
  upload: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    // The shared `api` instance defaults to Content-Type: application/json,
    // which persists even for a FormData body and prevents the browser from
    // negotiating the correct multipart boundary itself. Clearing it here
    // lets the browser set "multipart/form-data; boundary=..." correctly.
    return api.post<{ filePath: string }>('/api/media/upload', form, {
      headers: { 'Content-Type': undefined },
    }).then(r => r.data)
  },
  analyze: (filePath: string) =>
    api.post<{ sessionId: string }>('/api/media/analyze', { filePath }).then(r => r.data),
}

export const transcriptApi = {
  get: (sessionId: string) =>
    api.get<TranscriptResult>(`/api/transcript/${sessionId}`).then(r => r.data),
  getSentiment: (sessionId: string) =>
    api.get<SentimentResult>(`/api/sentiment/${sessionId}`).then(r => r.data),
  getSummary: (sessionId: string) =>
    api.get<SummaryResult>(`/api/summary/${sessionId}`).then(r => r.data),
}

export const historyApi = {
  getAll: () => api.get<Session[]>('/api/history').then(r => r.data),
  delete: (sessionId: string) => api.delete(`/api/history/${sessionId}`),
}

export const ttsApi = {
  synthesize: (text: string, voice?: string): Promise<Blob> =>
    api.post('/api/tts', { text, voice }, { responseType: 'blob' }).then(r => r.data),
}

export const cliApi = {
  status: () => api.get<CliStatus>('/api/cli/status').then(r => r.data),
  query: (sessionId: string, question: string, cli: string) =>
    api.post('/api/cli/query', { sessionId, question, cli }),
}
