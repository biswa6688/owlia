import { Link } from 'react-router-dom'
import { ThemeToggle } from '../../components/UI/ThemeToggle'

export function Landing() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="flex items-center justify-between border-b border-[var(--border)] px-8 py-4">
        <div className="flex items-center gap-2">
          <img src="/owlia.svg" alt="OWLIA" className="h-8 w-8" />
          <span className="text-lg font-semibold">OWLIA</span>
        </div>
        <nav className="flex items-center gap-6 text-sm">
          <Link to="/playground" className="hover:text-[var(--accent)]">Playground</Link>
          <Link to="/history" className="hover:text-[var(--accent)]">History</Link>
          <Link to="/download" className="hover:text-[var(--accent)]">Download</Link>
          <ThemeToggle />
        </nav>
      </header>
      <main className="px-8 py-16">
        <h1 className="text-4xl font-bold">Offline Voice &amp; Language Intelligence Analytics</h1>
        <p className="mt-4 max-w-2xl text-[var(--text-muted)]">
          Speech-to-text, speaker diarization, sentiment analysis, summarization and
          text-to-speech — fully offline, powered by local ONNX models.
        </p>
        <Link
          to="/playground"
          className="mt-8 inline-block rounded-full bg-[var(--accent)] px-6 py-3 font-medium text-[var(--color-owl-near-black)]"
        >
          Open Playground
        </Link>
      </main>
    </div>
  )
}
