import { create } from 'zustand'
import type { ModelStatus } from '../api/client'
import { modelsApi } from '../api/client'

// Which models are required for each feature
export const MODEL_REQUIREMENTS: Record<string, string[]> = {
  transcribe: ['silero-vad', 'whisper-large-v3'],
  diarize: ['pyannote-seg', 'wespeaker-ecapa'],
  sentiment: ['roberta-sentiment'],
  summary: ['bart-cnn'],
  tts: ['kokoro-tts'],
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
      const models = await modelsApi.getAll()
      set({ models, loaded: true })
    } catch {
      set({ loaded: true }) // backend may not be up yet
    }
  },

  isReady: (feature: string) => {
    const { models } = get()
    const required = MODEL_REQUIREMENTS[feature] ?? []
    return required.every(id => models.find(m => m.id === id)?.downloaded)
  },

  allDownloaded: () => {
    const { models } = get()
    return models.length > 0 && models.every(m => m.downloaded)
  },
}))
