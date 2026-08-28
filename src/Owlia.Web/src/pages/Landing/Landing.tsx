import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mic, Users, BarChart2, FileText, Volume2, Terminal,
  ChevronDown, ArrowRight, Check, Zap, Shield, Cpu,
} from 'lucide-react'
import { ThemeToggle } from '../../components/UI/ThemeToggle'

// ── Product mockup transcript data ──────────────────────────────────────────
const MOCK_LINES = [
  { speaker: 'A', color: '#f2a35b', text: 'Can we go over the Q4 roadmap before the board meeting?', time: '0:00', sentiment: 0.62 },
  { speaker: 'B', color: '#feb903', text: 'Sure — I think the main priority is the ML pipeline. We need to ship the new embeddings by December.', time: '0:04', sentiment: 0.78 },
  { speaker: 'A', color: '#f2a35b', text: 'Agreed. What about the infrastructure migration? Are we still on track for the Kubernetes rollout?', time: '0:12', sentiment: 0.54 },
  { speaker: 'C', color: '#d0805f', text: 'The staging environment is ready. Production rollout is scheduled for next sprint.', time: '0:19', sentiment: 0.71 },
  { speaker: 'B', color: '#feb903', text: 'One blocker — the vendor API rate limits could slow us down. We may need to negotiate higher tiers.', time: '0:26', sentiment: 0.38 },
]

// ── Data ─────────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: Mic, color: '#f2a35b',
    title: 'Speech-to-Text',
    tag: 'Whisper large-v3',
    desc: 'State-of-the-art accuracy across 99 languages. Word-level timestamps let you jump straight to any moment.',
  },
  {
    icon: Users, color: '#feb903',
    title: 'Speaker Diarization',
    tag: 'pyannote + WeSpeaker',
    desc: 'Automatically identifies who said what. ECAPA-TDNN speaker embeddings clustered into labeled speaker tracks.',
  },
  {
    icon: BarChart2, color: '#d0805f',
    title: 'Sentiment Analysis',
    tag: 'RoBERTa',
    desc: 'Per-sentence 0–100 score. See emotional tone shift by speaker over the full conversation timeline.',
  },
  {
    icon: FileText, color: '#f2a35b',
    title: 'Summarization',
    tag: 'BART-large-CNN',
    desc: 'Distills long recordings into a concise summary, top keywords, and numbered key takeaways.',
  },
  {
    icon: Volume2, color: '#feb903',
    title: 'Text-to-Speech',
    tag: 'Kokoro v1.0',
    desc: 'High-quality neural TTS reads any segment back to you. Useful for reviewing transcripts hands-free.',
  },
  {
    icon: Terminal, color: '#d0805f',
    title: 'Ask Your Transcript',
    tag: 'Claude CLI · OpenCode',
    desc: 'Pipe session context to Claude or OpenCode and ask natural-language questions. Streamed in real time.',
  },
]

const STEPS = [
  { n: 1, icon: '🎬', title: 'Drop any media', body: 'Drag an audio or video file — MP3, WAV, MP4, MKV, WebM and more. ffmpeg handles any codec.' },
  { n: 2, icon: '🔊', title: 'Voice detection', body: 'Silero VAD finds the exact speech segments, skipping silence and background noise.' },
  { n: 3, icon: '📝', title: 'Transcription', body: 'Whisper large-v3 converts each segment to text with millisecond-accurate word timestamps.' },
  { n: 4, icon: '👥', title: 'Speaker ID', body: 'pyannote segments the audio; WeSpeaker embeds each speaker; agglomerative clustering assigns names.' },
  { n: 5, icon: '✨', title: 'Analysis', body: 'RoBERTa scores sentiment per sentence. BART summarizes. Everything saves to your local SQLite history.' },
]

const PILLARS = [
  { icon: Shield, label: 'Fully private', body: 'Zero data leaves your machine. No cloud, no telemetry.' },
  { icon: Cpu, label: 'CPU-only', body: 'ONNX Runtime runs on any modern CPU. GPU optional.' },
  { icon: Zap, label: 'Instant replay', body: 'Click any line in the transcript to jump the player to that moment.' },
]

const FAQ = [
  { q: 'Is my audio sent anywhere?', a: 'Never. Every model runs locally via ONNX Runtime. After the one-time model download there is no internet requirement.' },
  { q: 'How much disk space do models need?', a: '~5.7 GB for all seven models. You can download only what you need — e.g. just Whisper + Silero for basic transcription.' },
  { q: 'What formats are supported?', a: 'Any container ffmpeg can read: MP3, WAV, FLAC, OGG, MP4, MKV, MOV, WebM and more. ffmpeg is bundled with the installer.' },
  { q: 'How much RAM does it need?', a: '8 GB minimum; 16 GB recommended for smooth transcription. Running all models simultaneously peaks at ~36 GB.' },
  { q: 'Does it need a GPU?', a: 'No — everything runs on CPU out of the box. ONNX Runtime GPU (DirectML) support is planned for a future release.' },
  { q: 'How does the CLI integration work?', a: 'OWLIA writes a JSON snapshot of your session to a temp file and passes it to Claude CLI or OpenCode as context. Responses stream into the app in real time.' },
]

// ── Shared nav — reused in History/Download too via import ────────────────────
function Nav() {
  return (
    <header
      className="sticky top-0 z-50 flex items-center justify-between px-6 py-3 backdrop-blur-md"
      style={{
        borderBottom: '1px solid var(--border)',
        background: 'color-mix(in srgb, var(--bg) 82%, transparent)',
      }}
    >
      <div className="flex items-center gap-2.5">
        <img src="/owlia.svg" alt="OWLIA" style={{ width: 30, height: 30 }} />
        <span style={{ fontWeight: 700, fontSize: '1.05rem', letterSpacing: '0.03em' }}>OWLIA</span>
      </div>
      <nav className="flex items-center gap-5 text-sm font-medium">
        <Link to="/playground" className="opacity-70 transition-opacity hover:opacity-100">Playground</Link>
        <Link to="/history"    className="opacity-70 transition-opacity hover:opacity-100">History</Link>
        <Link to="/download"   className="opacity-70 transition-opacity hover:opacity-100">Download</Link>
        <ThemeToggle />
      </nav>
    </header>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Landing() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--text)', minHeight: '100vh' }}>
      <Nav />

      {/* ══ HERO ══════════════════════════════════════════════════════════════ */}
      <section
        className="bg-grid relative overflow-hidden"
        style={{ minHeight: '92vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '80px 24px 48px' }}
      >
        {/* Centred amber bloom */}
        <div
          className="pointer-events-none absolute"
          style={{
            width: 700, height: 480, left: '35%', top: '50%',
            transform: 'translate(-50%,-50%)',
            background: 'radial-gradient(ellipse, rgba(242,163,91,0.15) 0%, rgba(254,185,3,0.07) 50%, transparent 72%)',
            filter: 'blur(40px)',
          }}
        />

        {/* ── Two-column row: text + product mockup ── */}
        <div
          className="relative"
          style={{
            maxWidth: 1140, margin: '0 auto', width: '100%',
            display: 'flex', alignItems: 'center', gap: 'clamp(32px, 4vw, 72px)',
            flexWrap: 'wrap',
          }}
        >
          {/* ── Left: text + buttons ── */}
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65 }}
            style={{ flex: '1 1 380px', minWidth: 300 }}
          >
            {/* Badge */}
            <div
              className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-widest mb-6"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--accent)' }}
            >
              100 % Offline · ONNX · Windows 10 / 11
            </div>

            <h1
              style={{
                fontSize: 'clamp(2rem, 4vw, 3.2rem)',
                fontWeight: 800,
                lineHeight: 1.12,
                letterSpacing: '-0.02em',
                marginBottom: '1.25rem',
              }}
            >
              Every conversation,{' '}
              <span style={{ color: 'var(--accent)' }}>fully understood.</span>
            </h1>

            <p
              style={{
                fontSize: 'clamp(0.95rem, 1.8vw, 1.1rem)',
                lineHeight: 1.7,
                color: 'var(--text-muted)',
                maxWidth: 480,
                marginBottom: '2rem',
              }}
            >
              Speech-to-text, speaker diarization, sentiment analysis, summarisation
              and text-to-speech — powered by local ONNX models.
              Zero data leaves your machine.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/playground"
                className="inline-flex items-center gap-2 rounded-full font-semibold transition-all hover:brightness-110 active:scale-95"
                style={{ background: 'var(--accent)', color: '#1a1210', padding: '0.75rem 1.75rem', fontSize: '0.95rem' }}
              >
                Open Playground <ArrowRight size={15} />
              </Link>
              <Link
                to="/download"
                className="inline-flex items-center gap-2 rounded-full font-semibold transition-all hover:brightness-105"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', padding: '0.75rem 1.75rem', fontSize: '0.95rem' }}
              >
                Get Models
              </Link>
            </div>
          </motion.div>

          {/* ── Right: product display browser chrome ── */}
          <motion.div
            initial={{ opacity: 0, y: 36 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            style={{ flex: '1 1 440px', minWidth: 340, position: 'relative' }}
          >
            {/* Subtle outer glow behind the frame */}
            <div
              style={{
                position: 'absolute', inset: -20, zIndex: 0, pointerEvents: 'none',
                borderRadius: 28,
                background: 'radial-gradient(ellipse at 60% 50%, rgba(242,163,91,0.10) 0%, transparent 65%)',
              }}
            />

            {/* Browser chrome frame */}
            <div
              style={{
                position: 'relative', zIndex: 1,
                borderRadius: 14,
                border: '1px solid var(--border)',
                overflow: 'hidden',
                boxShadow: '0 8px 32px rgba(0,0,0,0.15), 0 0 0 1px var(--border)',
                background: 'var(--bg)',
              }}
            >
              {/* Title bar */}
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 14px',
                  background: 'var(--surface)',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <div style={{ display: 'flex', gap: 5, marginRight: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f57' }} />
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ffbd2e' }} />
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#28c840' }} />
                </div>
                <div
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center',
                    background: 'var(--bg)', borderRadius: 7,
                    padding: '4px 10px', fontSize: '0.68rem',
                    color: 'var(--text-muted)', border: '1px solid var(--border)',
                    fontFamily: 'monospace',
                  }}
                >
                  <span style={{ color: 'var(--accent)', marginRight: 5 }}>🔒</span>
                  localhost:5173/playground
                </div>
              </div>

              {/* Content — mock playground */}
              <div style={{ display: 'flex', height: 340, overflow: 'hidden' }}>
                {/* Sidebar */}
                <div
                  style={{
                    width: 48, flexShrink: 0,
                    background: 'var(--surface)',
                    borderRight: '1px solid var(--border)',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', padding: '14px 0', gap: 14,
                  }}
                >
                  {[Mic, BarChart2, FileText, Volume2, Terminal].map((Icon, i) => (
                    <div
                      key={i}
                      style={{
                        width: 32, height: 32, borderRadius: 9,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: i === 0 ? 'var(--accent)' : 'transparent',
                        color: i === 0 ? '#1a1210' : 'var(--text-muted)',
                      }}
                    >
                      <Icon size={14} />
                    </div>
                  ))}
                </div>

                {/* Main panel */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  {/* Toolbar */}
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 14px',
                      borderBottom: '1px solid var(--border)',
                      background: 'var(--surface)',
                    }}
                  >
                    <div style={{ flex: 1, display: 'flex', gap: 3 }}>
                      {['Transcript', 'Sentiment', 'Summary'].map((tab, i) => (
                        <div
                          key={tab}
                          style={{
                            padding: '3px 10px', borderRadius: 7, fontSize: '0.68rem', fontWeight: 600,
                            background: i === 0 ? 'var(--accent)' : 'transparent',
                            color: i === 0 ? '#1a1210' : 'var(--text-muted)',
                          }}
                        >
                          {tab}
                        </div>
                      ))}
                    </div>
                    <div
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '3px 8px', borderRadius: 7,
                        background: 'var(--bg)', border: '1px solid var(--border)',
                        fontSize: '0.64rem', color: 'var(--text-muted)',
                      }}
                    >
                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)' }} />
                      1:42 / 3:18
                    </div>
                  </div>

                  {/* Transcript lines */}
                  <div style={{ flex: 1, overflow: 'hidden', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {MOCK_LINES.map((line, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <div
                          style={{
                            width: 24, height: 24, borderRadius: 7, flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: `${line.color}22`, color: line.color,
                            fontSize: '0.62rem', fontWeight: 700,
                            border: `1px solid ${line.color}33`,
                          }}
                        >
                          {line.speaker}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: 1 }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text)' }}>
                              Speaker {line.speaker}
                            </span>
                            <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)' }}>
                              {line.time}
                            </span>
                          </div>
                          <p style={{ margin: 0, fontSize: '0.76rem', lineHeight: 1.5, color: 'var(--text-muted)' }}>
                            {line.text}
                          </p>
                          <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                            <div style={{ width: 72, height: 3, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
                              <div
                                style={{
                                  width: `${line.sentiment * 100}%`, height: '100%', borderRadius: 2,
                                  background: line.sentiment > 0.6
                                    ? '#28c840'
                                    : line.sentiment > 0.4
                                      ? '#ffbd2e'
                                      : '#ff5f57',
                                }}
                              />
                            </div>
                            <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>
                              {Math.round(line.sentiment * 100)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Status bar */}
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '6px 14px',
                      borderTop: '1px solid var(--border)',
                      background: 'var(--surface)',
                      fontSize: '0.58rem', color: 'var(--text-muted)',
                    }}
                  >
                    <span>3 speakers · 4 min 12 sec</span>
                    <span>ONNX Runtime · CPU</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* ── Three pillars — below the two-column row ── */}
        <div className="relative mt-14 flex flex-wrap justify-center gap-4" style={{ maxWidth: 700, margin: '3.5rem auto 0', width: '100%' }}>
          {PILLARS.map(({ icon: Icon, label, body }) => (
            <div
              key={label}
              className="flex items-start gap-3 rounded-2xl px-5 py-4"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', flex: '1 1 170px', minWidth: 160 }}
            >
              <Icon size={17} style={{ color: 'var(--accent)', marginTop: 2, flexShrink: 0 }} />
              <div>
                <p style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 2 }}>{label}</p>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{body}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Scroll cue */}
        <motion.div
          className="absolute bottom-6 left-1/2 -translate-x-1/2"
          animate={{ y: [0, 7, 0] }}
          transition={{ repeat: Infinity, duration: 1.9, ease: 'easeInOut' }}
        >
          <ChevronDown size={20} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
        </motion.div>
      </section>

      {/* ══ FEATURES GRID ═════════════════════════════════════════════════════ */}
      <section style={{ padding: '96px 24px', background: 'var(--surface)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <p style={{ fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.12em', color: 'var(--accent)', textTransform: 'uppercase', textAlign: 'center', marginBottom: '0.6rem' }}>
            Seven ONNX models
          </p>
          <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', fontWeight: 700, textAlign: 'center', marginBottom: '0.6rem' }}>
            Everything in one place
          </h2>
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginBottom: '3.5rem', fontSize: '0.95rem' }}>
            All processing runs locally — no subscriptions, no API keys, no data upload.
          </p>

          <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
            {FEATURES.map(({ icon: Icon, color, title, tag, desc }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07, duration: 0.4 }}
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 20,
                  padding: '1.5rem',
                  transition: 'box-shadow 0.2s',
                }}
                whileHover={{ boxShadow: `0 0 0 2px ${color}33` }}
              >
                {/* Icon + model tag */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <div
                    style={{
                      width: 46, height: 46, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: `${color}18`, border: `1px solid ${color}33`,
                    }}
                  >
                    <Icon size={21} style={{ color }} />
                  </div>
                  <span
                    style={{
                      fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.05em',
                      color, background: `${color}14`, border: `1px solid ${color}28`,
                      borderRadius: 100, padding: '3px 10px',
                    }}
                  >
                    {tag}
                  </span>
                </div>
                <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.4rem' }}>{title}</h3>
                <p style={{ fontSize: '0.855rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ HOW IT WORKS ══════════════════════════════════════════════════════ */}
      <section className="bg-grid" style={{ padding: '96px 24px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <p style={{ fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.12em', color: 'var(--accent)', textTransform: 'uppercase', textAlign: 'center', marginBottom: '0.6rem' }}>
            Pipeline
          </p>
          <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', fontWeight: 700, textAlign: 'center', marginBottom: '3.5rem' }}>
            How it works
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {STEPS.map((step, i) => (
              <motion.div
                key={step.n}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.4 }}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: '1.25rem',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 18, padding: '1.25rem 1.5rem',
                }}
              >
                {/* Number bubble */}
                <div
                  style={{
                    width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'var(--accent)', color: '#1a1210', fontWeight: 800, fontSize: '0.95rem',
                  }}
                >
                  {step.n}
                </div>
                {/* Emoji + text */}
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.25rem' }}>
                    {step.icon} {step.title}
                  </p>
                  <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                    {step.body}
                  </p>
                </div>
                {/* Connector dot for all but last */}
                {i < STEPS.length - 1 && (
                  <div style={{ position: 'absolute', display: 'none' }} />
                )}
              </motion.div>
            ))}
          </div>

          {/* CTA after pipeline */}
          <div style={{ textAlign: 'center', marginTop: '3rem' }}>
            <Link
              to="/playground"
              className="inline-flex items-center gap-2 rounded-full font-semibold transition-all hover:brightness-110"
              style={{ background: 'var(--accent)', color: '#1a1210', padding: '0.75rem 2rem', fontSize: '0.95rem' }}
            >
              Try it now <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </section>

      {/* ══ FAQ ═══════════════════════════════════════════════════════════════ */}
      <section style={{ padding: '96px 24px', background: 'var(--surface)' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <p style={{ fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.12em', color: 'var(--accent)', textTransform: 'uppercase', textAlign: 'center', marginBottom: '0.6rem' }}>
            Questions
          </p>
          <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', fontWeight: 700, textAlign: 'center', marginBottom: '2.5rem' }}>
            Frequently asked
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {FAQ.map((item, i) => (
              <div
                key={i}
                style={{
                  borderRadius: 16, overflow: 'hidden',
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', padding: '1rem 1.25rem',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text)', fontWeight: 600, fontSize: '0.92rem',
                    textAlign: 'left', gap: '1rem',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Check size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    {item.q}
                  </span>
                  <motion.span
                    animate={{ rotate: openFaq === i ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ flexShrink: 0 }}
                  >
                    <ChevronDown size={17} style={{ color: 'var(--text-muted)' }} />
                  </motion.span>
                </button>

                <AnimatePresence initial={false}>
                  {openFaq === i && (
                    <motion.div
                      key="body"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22 }}
                      style={{ overflow: 'hidden' }}
                    >
                      <p
                        style={{
                          padding: '0 1.25rem 1rem 3.1rem',
                          fontSize: '0.875rem', lineHeight: 1.65,
                          color: 'var(--text-muted)',
                        }}
                      >
                        {item.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FOOTER CTA ════════════════════════════════════════════════════════ */}
      <footer
        className="bg-grid"
        style={{ padding: '80px 24px', textAlign: 'center', borderTop: '1px solid var(--border)' }}
      >
        <div
          style={{
            display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
            gap: '1.5rem', maxWidth: 520,
          }}
        >
          <img src="/owlia.svg" alt="OWLIA" style={{ width: 52, height: 52, opacity: 0.85 }} />
          <h2 style={{ fontSize: 'clamp(1.4rem, 3vw, 1.9rem)', fontWeight: 700, margin: 0 }}>
            Start analysing your conversations
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
            Completely offline. Models download once, analysis runs forever.
          </p>
          <Link
            to="/playground"
            className="inline-flex items-center gap-2 rounded-full font-semibold transition-all hover:brightness-110"
            style={{ background: 'var(--accent)', color: '#1a1210', padding: '0.8rem 2.2rem', fontSize: '0.95rem' }}
          >
            Open Playground <ArrowRight size={15} />
          </Link>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', opacity: 0.6 }}>
            MIT License · All processing runs locally
          </p>
        </div>
      </footer>
    </div>
  )
}
