import { Link, useLocation } from 'react-router-dom'
import { ThemeToggle } from '../UI/ThemeToggle'

const LINKS = [
  { to: '/playground', label: 'Playground' },
  { to: '/history',    label: 'History'    },
  { to: '/download',   label: 'Download'   },
] as const

export function Nav() {
  const { pathname } = useLocation()
  const active = (to: string) => pathname.startsWith(to)

  return (
    <header
      className="sticky top-0 z-50 flex items-center justify-between px-6 py-3 backdrop-blur-md"
      style={{
        borderBottom: '1px solid var(--border)',
        background: 'color-mix(in srgb, var(--bg) 82%, transparent)',
      }}
    >
      <Link to="/landing" className="flex items-center gap-2.5" style={{ textDecoration: 'none', color: 'var(--text)' }}>
        <img src="/owlia.svg" alt="OWLIA" style={{ width: 30, height: 30 }} />
        <span style={{ fontWeight: 700, fontSize: '1.05rem', letterSpacing: '0.03em' }}>OWLIA</span>
      </Link>

      <nav className="flex items-center gap-1 text-sm font-medium">
        {LINKS.map(({ to, label }) => {
          const isAct = active(to)
          return (
            <Link
              key={to}
              to={to}
              className="transition-colors"
              style={{
                textDecoration: 'none',
                fontSize: '0.82rem',
                fontWeight: isAct ? 700 : 500,
                color: isAct ? 'var(--accent)' : 'var(--text-muted)',
                padding: '6px 12px',
                borderRadius: 8,
                background: isAct ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
                transition: 'background 0.15s, color 0.15s',
              }}
              onMouseEnter={e => { if (!isAct) e.currentTarget.style.background = 'color-mix(in srgb, var(--text) 5%, transparent)' }}
              onMouseLeave={e => { if (!isAct) e.currentTarget.style.background = 'transparent' }}
            >
              {label}
            </Link>
          )
        })}
        <div style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 4px' }} />
        <ThemeToggle />
      </nav>
    </header>
  )
}
