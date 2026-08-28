import { create } from 'zustand'
import type { SpeakerSegment, SentimentResult, SummaryResult } from '../api/client'

export type AnalysisStage = 'idle' | 'audio' | 'vad' | 'asr' | 'diarization' | 'sentiment' | 'saving' | 'summary' | 'done' | 'error'

interface PlaygroundState {
  // Media
  mediaFile: File | null
  mediaUrl: string | null

  // Session
  sessionId: string | null

  // Analysis
  stage: AnalysisStage
  progress: number
  error: string | null

  // Results
  segments: SpeakerSegment[]
  sentiment: SentimentResult | null
  summary: SummaryResult | null

  // Player state
  currentTimeMs: number
  activeSegmentIndex: number

  // Actions
  setMediaFile: (file: File) => void
  setSessionId: (id: string) => void
  setStage: (stage: AnalysisStage, progress: number) => void
  setError: (error: string) => void
  addSegment: (segment: SpeakerSegment) => void
  setSegments: (segments: SpeakerSegment[]) => void
  setSentiment: (sentiment: SentimentResult) => void
  setSummary: (summary: SummaryResult) => void
  setCurrentTimeMs: (ms: number) => void
  reset: () => void
}

const initial = {
  mediaFile: null,
  mediaUrl: null,
  sessionId: null,
  stage: 'idle' as AnalysisStage,
  progress: 0,
  error: null,
  segments: [],
  sentiment: null,
  summary: null,
  currentTimeMs: 0,
  activeSegmentIndex: -1,
}

export const usePlaygroundStore = create<PlaygroundState>((set, get) => ({
  ...initial,

  setMediaFile: (file) => {
    const prev = get().mediaUrl
    if (prev) URL.revokeObjectURL(prev)
    set({ mediaFile: file, mediaUrl: URL.createObjectURL(file) })
  },

  setSessionId: (id) => set({ sessionId: id }),

  setStage: (stage, progress) => set({ stage, progress }),

  setError: (error) => set({ stage: 'error', error }),

  addSegment: (segment) =>
    set(s => ({ segments: [...s.segments, segment] })),

  setSegments: (segments) => set({ segments }),

  setSentiment: (sentiment) => set({ sentiment }),

  setSummary: (summary) => set({ summary }),

  setCurrentTimeMs: (ms) => {
    const { segments } = get()
    let idx = -1
    for (let i = 0; i < segments.length; i++) {
      if (ms >= segments[i].startMs && ms <= segments[i].endMs) {
        idx = i
        break
      }
    }
    set({ currentTimeMs: ms, activeSegmentIndex: idx })
  },

  reset: () => {
    const prev = get().mediaUrl
    if (prev) URL.revokeObjectURL(prev)
    set(initial)
  },
}))

// Speaker colors — consistent hue per speaker name
const SPEAKER_HUES = [30, 200, 120, 280, 0, 60, 160, 320]
const _hueCache = new Map<string, string>()
let _hueIdx = 0

export function speakerColor(speaker: string): string {
  if (_hueCache.has(speaker)) return _hueCache.get(speaker)!
  const hue = SPEAKER_HUES[_hueIdx++ % SPEAKER_HUES.length]
  const color = `hsl(${hue}, 65%, 55%)`
  _hueCache.set(speaker, color)
  return color
}
