import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mic, Users, BarChart2, FileText, Volume2, Terminal,
  ChevronDown, ChevronRight, ArrowRight,
} from 'lucide-react'
import { ThemeToggle } from '../../components/UI/ThemeToggle'

// ── Features ─────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: Mic,
    title: 'Speech-to-Text',
    desc: 'Whisper large-v3 — state-of-the-art accuracy in 99 languages, with word-level timestamps.',
  },
  {
    icon: Users,
    title: 'Speaker Diarization',
    desc: 'pyannote + WeSpeaker ECAPA-TDNN — automatically separates who said what.',
  },
  {
    icon: BarChart2,
    title: 'Sentiment Analysis',
    desc: 'RoBERTa per-sentence scoring 0–100. See tone by speaker and over time.',
  },
  {
    icon: FileText,
    title: 'Summarization',
    desc: 'BART-large-CNN distills long conversations into summary, keywords and key takeaways.',
  },
  {
    icon: Volume2,
    title: 'Text-to-Speech',
    desc: 'Kokoro v1.0 — high-quality TTS to read back any transcript segment.',
  },
  {
    icon: Terminal,
    title: 'CLI Integration',
    desc: 'Ask questions about your transcript via Claude CLI or OpenCode — streamed in real-time.',
  },
]

// ── Pipeline steps ────────────────────────────────────────────────────────────

const STEPS = [
  { num: '01', label: 'Load Media', desc: 'Drop any audio or video file' },
  { num: '02', label: 'VAD', desc: 'Detect voice activity with Silero' },
  { num: '03', label: 'Transcribe', desc: 'Whisper large-v3 with timestamps' },
  { num: '04', label: 'Diarize', desc: 'Cluster speaker identities' },
  { num: '05', label: 'Analyse', desc: 'Sentiment · Summary · TTS' },
]

// ── FAQ ───────────────────────────────────────────────────────────────────────

const FAQ = [
  {
    q: 'Is my audio sent to any server?',
    a: 'Never. Everything runs locally on your machine using ONNX models. No internet connection is required after the one-time model download.',
  },
  {
    q: 'How much disk space do the models need?',
    a: 'About 5.7 GB total for all seven models. You can download only what you need — e.g. just Whisper for transcription without diarization.',
  },
  {
    q: 'What audio/video formats are supported?',
    a: 'Any format ffmpeg can read — MP3, WAV, FLAC, MP4, MKV, MOV, WebM and more. ffmpeg is bundled with the installer.',
  },
  {
    q: 'How much RAM does it need?',
    a: '8 GB minimum; 16 GB recommended. Running all models simultaneously requires ~36 GB. Models are loaded on demand and can be unloaded.',
  },
  {
    q: 'Does it work without a GPU?',
    a: 'Yes — ONNX Runtime runs on CPU. Processing will be slower but fully functional. GPU acceleration via DirectML is on the roadmap.',
  },
  {
    q: 'What is the CLI integration?',
    a: 'OWLIA can pipe transcript context to Claude CLI or OpenCode CLI so you can ask natural-language questions about your recordings.',
  },
]

// ── Component ─────────────────────────────────────────────────────────────────

export function Landing() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>

      {/* ── Nav ── */}
      <header
        className="sticky top-0 z-50 flex items-center justify-between px-8 py-4 backdrop-blur-md"
        style={{ borderBottom: '1px solid var(--border)', background: 'color-mix(in srgb, var(--bg) 85%, transparent)' }}
      >
        <div className="flex items-center gap-2">
          <img src="/owlia.svg" alt="OWLIA" className="h-8 w-8" />
          <span className="text-lg font-bold tracking-wide">OWLIA</span>
        </div>
        <nav className="flex items-center gap-6 text-sm font-medium">
          <Link to="/playground" className="transition-colors hover:text-[var(--accent)]">Playground</Link>
          <Link to="/history" className="transition-colors hover:text-[var(--accent)]">History</Link>
          <Link to="/download" className="transition-colors hover:text-[var(--accent)]">Download</Link>
          <ThemeToggle />
        </nav>
      </header>

      {/* ── Hero ── */}
      <section className="relative flex min-h-[92vh] flex-col items-center justify-center overflow-hidden px-8 text-center">
        {/* Animated gradient orb */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
          style={{
            width: 700,
            height: 500,
            background: 'radial-gradient(ellipse, rgba(242,163,91,0.22) 0%, rgba(254,185,3,0.10) 50%, transparent 70%)',
            animation: 'pulse 6s ease-in-out infinite',
          }}
        />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="relative max-w-3xl"
        >
          <div
            className="mb-4 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-widest"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--accent)' }}
          >
            100% Offline · ONNX · Windows 10/11
          </div>

          <h1 className="text-5xl font-extrabold leading-tight md:text-6xl">
            Your conversations.{' '}
            <span style={{ color: 'var(--accent)' }}>Understood.</span>
          </h1>

          <p className="mt-5 text-lg leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            Speech-to-text, speaker diarization, sentiment analysis, summarisation and
            text-to-speech — all running locally, powered by ONNX models. Zero data leaves your machine.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/playground"
              className="inline-flex items-center gap-2 rounded-full px-7 py-3 font-semibold transition-all hover:brightness-110 active:scale-95"
              style={{ background: 'var(--accent)', color: '#1a1210' }}
            >
              Open Playground <ArrowRight size={16} />
            </Link>
            <Link
              to="/download"
              className="inline-flex items-center gap-2 rounded-full px-7 py-3 font-semibold transition-all hover:bg-[var(--surface-2)]"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
            >
              Download Models
            </Link>
          </div>
        </motion.div>

        {/* Scroll cue */}
        <motion.div
          className="absolute bottom-8"
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 1.8 }}
        >
          <ChevronDown size={22} style={{ color: 'var(--text-muted)' }} />
        </motion.div>
      </section>

      {/* ── Features ── */}
      <section className="mx-auto max-w-6xl px-8 py-24">
        <h2 className="mb-2 text-center text-3xl font-bold">Everything in one place</h2>
        <p className="mb-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
          Seven ONNX models working together, fully offline.
        </p>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, desc }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07 }}
              className="rounded-2xl p-6 transition-shadow hover:shadow-lg"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <div
                className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl"
                style={{ background: 'var(--surface-2)' }}
              >
                <Icon size={22} style={{ color: 'var(--accent)' }} />
              </div>
              <h3 className="mb-2 font-semibold">{title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="py-24" style={{ background: 'var(--surface)' }}>
        <div className="mx-auto max-w-6xl px-8">
          <h2 className="mb-12 text-center text-3xl font-bold">How it works</h2>

          <div className="flex flex-col items-start gap-0 md:flex-row md:items-center md:justify-between">
            {STEPS.map((step, i) => (
              <div key={step.num} className="flex flex-row items-center gap-0 md:flex-col md:items-center">
                <div className="flex flex-col items-center md:items-center">
                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold"
                    style={{ background: 'var(--accent)', color: '#1a1210' }}
                  >
                    {step.num}
                  </div>
                  <p className="mt-2 text-center text-sm font-semibold">{step.label}</p>
                  <p className="mt-0.5 text-center text-xs" style={{ color: 'var(--text-muted)' }}>{step.desc}</p>
                </div>
                {i < STEPS.length - 1 && (
                  <ChevronRight
                    size={20}
                    className="mx-3 shrink-0 md:mx-4 md:mt-[-24px]"
                    style={{ color: 'var(--text-muted)' }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="mx-auto max-w-2xl px-8 py-24">
        <h2 className="mb-10 text-center text-3xl font-bold">FAQ</h2>
        <div className="flex flex-col gap-3">
          {FAQ.map((item, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-xl"
              style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
            >
              <button
                type="button"
                className="flex w-full items-center justify-between px-5 py-4 text-left font-medium transition-colors hover:text-[var(--accent)]"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                {item.q}
                <motion.div animate={{ rotate: openFaq === i ? 180 : 0 }} transition={{ duration: 0.2 }}>
                  <ChevronDown size={18} style={{ color: 'var(--text-muted)' }} />
                </motion.div>
              </button>
              <AnimatePresence initial={false}>
                {openFaq === i && (
                  <motion.div
                    key="body"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22 }}
                  >
                    <p className="px-5 pb-4 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                      {item.a}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA Footer ── */}
      <footer
        className="py-16 text-center"
        style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)' }}
      >
        <p className="mb-6 text-2xl font-bold">Ready to start?</p>
        <Link
          to="/playground"
          className="inline-flex items-center gap-2 rounded-full px-8 py-3 font-semibold transition-all hover:brightness-110"
          style={{ background: 'var(--accent)', color: '#1a1210' }}
        >
          Open Playground <ArrowRight size={16} />
        </Link>
        <p className="mt-10 text-xs" style={{ color: 'var(--text-muted)' }}>
          OWLIA — MIT License · All processing runs locally on your machine
        </p>
      </footer>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.7; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 1; transform: translate(-50%, -50%) scale(1.08); }
        }
      `}</style>
    </div>
  )
}
