import { create } from 'zustand'

export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'owlia-theme'

function applyTheme(mode: ThemeMode) {
  const root = document.documentElement
  if (mode === 'system') {
    root.removeAttribute('data-theme')
  } else {
    root.setAttribute('data-theme', mode)
  }
}

function readStored(): ThemeMode {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  return 'system'
}

interface ThemeState {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
}

export const useThemeStore = create<ThemeState>((set) => {
  const initial = readStored()
  applyTheme(initial)
  return {
    mode: initial,
    setMode: (mode: ThemeMode) => {
      localStorage.setItem(STORAGE_KEY, mode)
      applyTheme(mode)
      set({ mode })
    },
  }
})
