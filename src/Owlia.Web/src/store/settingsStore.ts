import { create } from 'zustand'

const STORAGE_KEY = 'owlia-check-for-updates'

function readStored(): boolean {
  return localStorage.getItem(STORAGE_KEY) === 'true'
}

interface SettingsState {
  // Whether the Download page checks for CLI/model updates on load. Always
  // opt-in, always manual — this never triggers an automatic download or
  // install, only surfaces "a newer version exists" so the user can act on it.
  checkForUpdates: boolean
  setCheckForUpdates: (value: boolean) => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
  checkForUpdates: readStored(),
  setCheckForUpdates: (value: boolean) => {
    localStorage.setItem(STORAGE_KEY, String(value))
    set({ checkForUpdates: value })
  },
}))
