import { create } from 'zustand'
import type { ModelStatus } from '../api/client'
import { modelsApi } from '../api/client'

// Which models are required for each feature
export const MODEL_REQUIREMENTS: Record<string, string[]> = {
  transcribe: ['silero-vad', 'whisper-large-v3'],
  diarize:   ['pyannote-seg', 'wespeaker-ecapa'],
  sentiment: ['roberta-sentiment'],
  summary:   ['bart-cnn'],
  tts:       ['kokoro-tts'],
}

interface ModelState {
  models: ModelStatus[]
  loaded: boolean
  refresh: () => Promise<void>
  isReady: (feature: string) => boolean
  allDownloaded: () => boolean
}

export const useModelStore = create<ModelState>((set, get) => ({
  models: [],
  loaded: false,

  refresh: async () => {
    try {
      const raw = await modelsApi.getAll()
      // Guard: ensure we always store a real array, never undefined/object
      const models = Array.isArray(raw) ? raw : []
      set({ models, loaded: true })
    } catch {
      // Backend not reachable yet — keep models as [] and mark loaded so the
      // UI doesn't stay in a spinner; isReady will return true (no gate shown).
      set({ loaded: true })
    }
  },

  isReady: (feature: string) => {
    const { models } = get()
    // Defensive: if models isn't an array for any reason, don't crash — allow through
    if (!Array.isArray(models)) return true
    const required = MODEL_REQUIREMENTS[feature] ?? []
    if (required.length === 0) return true
    // If models list is empty (not yet loaded) allow through so nothing is blocked
    if (models.length === 0) return true
    return required.every(id => models.find(m => m.id === id)?.downloaded === true)
  },

  allDownloaded: () => {
    const { models } = get()
    if (!Array.isArray(models) || models.length === 0) return false
    return models.every(m => m.downloaded)
  },
}))
