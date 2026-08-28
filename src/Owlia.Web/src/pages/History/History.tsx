import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash2, Clock, Users, Calendar } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { ThemeToggle } from '../../components/UI/ThemeToggle'
import { historyApi, type Session } from '../../api/client'
import { Link } from 'react-router-dom'
import { usePlaygroundStore } from '../../store/playgroundStore'

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export function History() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const navigate = useNavigate()
  const store = usePlaygroundStore()

  useEffect(() => {
    historyApi.getAll()
      .then(setSessions)
      .finally(() => setLoading(false))
  }, [])

  const openSession = (session: Session) => {
    // Navigate to playground with session context
    // The playground will load segments from the API
    store.reset()
    store.setSessionId(session.id)
    navigate('/playground')
  }

  const deleteSession = async (id: string) => {
    setDeleting(id)
    try {
      await historyApi.delete(id)
      setSessions(prev => prev.filter(s => s.id !== id))
    } finally {
      setDeleting(null)
      setConfirmDelete(null)
    }
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>

      {/* Nav */}
      <header
        className="flex items-center justify-between px-8 py-4"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <Link to="/landing" className="flex items-center gap-2">
          <img src="/owlia.svg" alt="OWLIA" className="h-7 w-7" />
          <span className="font-bold">OWLIA</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link to="/playground" className="text-sm hover:text-[var(--accent)] transition-colors">Playground</Link>
          <Link to="/download" className="text-sm hover:text-[var(--accent)] transition-colors">Download</Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-8 py-10">
        <h1 className="mb-1 text-2xl font-bold">History</h1>
        <p className="mb-8 text-sm" style={{ color: 'var(--text-muted)' }}>
          Past transcription sessions. Click a card to reopen in the Playground.
        </p>

        {loading && (
          <div className="flex items-center justify-center py-20 text-sm" style={{ color: 'var(--text-muted)' }}>
            Loading…
          </div>
        )}

        {!loading && sessions.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-4 py-24" style={{ color: 'var(--text-muted)' }}>
            <img src="/owlia.svg" alt="" className="h-16 w-16 opacity-20" />
            <p>No sessions yet. Head to the Playground to analyse a media file.</p>
            <Link
              to="/playground"
              className="rounded-full px-5 py-2 text-sm font-semibold transition-all hover:brightness-110"
              style={{ background: 'var(--accent)', color: '#1a1210' }}
            >
              Open Playground
            </Link>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
            {sessions.map(session => (
              <motion.div
                key={session.id}
                layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{ duration: 0.2 }}
                className="group relative cursor-pointer rounded-2xl p-5 transition-shadow hover:shadow-lg"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                onClick={() => openSession(session)}
              >
                {/* File name */}
                <p className="mb-3 truncate font-semibold" title={session.fileName}>
                  {session.fileName}
                </p>

                {/* Meta */}
                <div className="flex flex-col gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <span className="flex items-center gap-1.5">
                    <Clock size={12} /> {formatDuration(session.durationSeconds)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Users size={12} /> {session.speakerCount} speaker{session.speakerCount !== 1 ? 's' : ''}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Calendar size={12} /> {formatDate(session.createdAt)}
                  </span>
                </div>

                {/* Delete button */}
                <button
                  type="button"
                  className="absolute right-3 top-3 rounded-full p-1.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-500 hover:text-white"
                  title="Delete session"
                  onClick={e => { e.stopPropagation(); setConfirmDelete(session.id) }}
                >
                  <Trash2 size={14} />
                </button>

                {/* Confirm overlay */}
                {confirmDelete === session.id && (
                  <div
                    className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-2xl"
                    style={{ background: 'color-mix(in srgb, var(--surface) 95%, transparent)' }}
                    onClick={e => e.stopPropagation()}
                  >
                    <p className="text-sm font-medium">Delete this session?</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="rounded-full bg-red-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-50"
                        disabled={deleting === session.id}
                        onClick={() => deleteSession(session.id)}
                      >
                        {deleting === session.id ? 'Deleting…' : 'Delete'}
                      </button>
                      <button
                        type="button"
                        className="rounded-full px-4 py-1.5 text-xs font-semibold hover:bg-[var(--surface-2)]"
                        style={{ border: '1px solid var(--border)' }}
                        onClick={() => setConfirmDelete(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}
