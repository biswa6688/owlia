import { Moon, Sun, Monitor } from 'lucide-react'
import { useThemeStore, type ThemeMode } from '../../store/themeStore'

const OPTIONS: { mode: ThemeMode; icon: typeof Sun; label: string }[] = [
  { mode: 'light', icon: Sun, label: 'Light' },
  { mode: 'dark', icon: Moon, label: 'Dark' },
  { mode: 'system', icon: Monitor, label: 'System' },
]

export function ThemeToggle() {
  const { mode, setMode } = useThemeStore()

  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] p-1">
      {OPTIONS.map(({ mode: optionMode, icon: Icon, label }) => (
        <button
          key={optionMode}
          type="button"
          aria-label={label}
          onClick={() => setMode(optionMode)}
          className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
            mode === optionMode
              ? 'bg-[var(--accent)] text-[var(--color-owl-near-black)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          <Icon size={16} strokeWidth={2} />
        </button>
      ))}
    </div>
  )
}
