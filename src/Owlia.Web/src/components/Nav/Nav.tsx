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

      <nav className="flex items-center gap-3 text-sm font-medium">
        {LINKS.map(({ to, label }) => {
          const isActive = active(to)
          const isPill = to !== '/playground'

          return (
            <Link
              key={to}
              to={to}
              className="transition-all"
              style={{
                textDecoration: 'none',
                fontSize: '0.82rem',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? 'var(--accent)' : 'var(--text)',
                ...(isPill
                  ? {
                      padding: '5px 14px',
                      borderRadius: 100,
                      border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                      background: isActive ? 'var(--accent)' : 'var(--surface)',
                      ...(isActive ? { color: '#1a1210' } : {}),
                    }
                  : {
                      opacity: isActive ? 1 : 0.65,
                    }),
              }}
            >
              {label}
            </Link>
          )
        })}
        <ThemeToggle />
      </nav>
    </header>
  )
}
