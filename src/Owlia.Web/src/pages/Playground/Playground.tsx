import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Maximize, Minimize, Plus, Loader2, AlertCircle,
} from 'lucide-react'
import { usePlaygroundStore } from '../../store/playgroundStore'
import { useModelStore } from '../../store/modelStore'
import { mediaApi, transcriptApi } from '../../api/client'
import { joinSession, leaveSession } from '../../api/signalr'
import { TranscriptList } from '../../components/Transcript/TranscriptList'
import { SentimentView } from '../../components/Sentiment/SentimentView'
import { SummaryView } from '../../components/Summary/SummaryView'
import { VoiceSpectrum } from '../../components/VoiceSpectrum/VoiceSpectrum'
import { CliPanel } from '../../components/Cli/CliPanel'
import { ModelGate } from '../../components/UI/ModelGateBanner'
import { ProgressBar } from '../../components/UI/ProgressBar'
import type { SpeakerSegment, SentimentResult, SummaryResult } from '../../api/client'

type Tab = 'transcript' | 'sentiment' | 'summary' | 'cli'

// Dark palette for the Playground (always dark regardless of global theme)
const P = {
  bg:       '#0f0b09',
  surface:  '#1e1510',
  panel:    '#261a14',
  bar:      '#2a1f1b',
  border:   'rgba(242,163,91,0.13)',
  text:     '#f0d8bc',
  muted:    '#c07850',
  accent:   '#f2a35b',
  gold:     '#feb903',
} as const

function fmtTime(sec: number) {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

// Inject dark CSS vars into a style attribute for child components
const DARK_VARS: React.CSSProperties = {
  '--text':     P.text,
  '--text-muted': P.muted,
  '--surface':  P.panel,
  '--surface-2':'#3a2c26',
  '--border':   P.border,
  '--accent':   P.accent,
  '--bg':       P.surface,
} as React.CSSProperties

export function Playground() {
  const store = usePlaygroundStore()
  const { refresh: refreshModels, isReady } = useModelStore()
  const videoRef      = useRef<HTMLVideoElement>(null)
  const containerRef  = useRef<HTMLDivElement>(null)
  const fileInputRef  = useRef<HTMLInputElement>(null)

  const [tab, setTab]               = useState<Tab>('transcript')
  const [playing, setPlaying]       = useState(false)
  const [muted, setMuted]           = useState(false)
  const [volume, setVolume]         = useState(1)
  const [currentSec, setCurrentSec] = useState(0)
  const [durationSec, setDuration]  = useState(0)
  const [speed, setSpeed]           = useState(1)
  const [fullscreen, setFullscreen] = useState(false)
  const [subtitle, setSubtitle]     = useState('')
  const [dragging, setDragging]     = useState(false)

  useEffect(() => { refreshModels() }, [refreshModels])

  // ── Session restore (navigated from History) ───────────────────────────
  useEffect(() => {
    const { sessionId, segments } = store
    if (!sessionId || segments.length > 0) return
    Promise.allSettled([
      transcriptApi.get(sessionId),
      transcriptApi.getSentiment(sessionId),
      transcriptApi.getSummary(sessionId),
    ]).then(([t, s, sum]) => {
      if (t.status === 'fulfilled' && t.value?.segments?.length) {
        store.setSegments(t.value.segments)
        store.setStage('done', 100)
      }
      if (s.status   === 'fulfilled' && s.value)   store.setSentiment(s.value as SentimentResult)
      if (sum.status === 'fulfilled' && sum.value)  store.setSummary(sum.value as SummaryResult)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Player ─────────────────────────────────────────────────────────────
  const onTimeUpdate = useCallback(() => {
    const v = videoRef.current; if (!v) return
    const ms = v.currentTime * 1000
    setCurrentSec(v.currentTime)
    store.setCurrentTimeMs(ms)
    setSubtitle(store.segments.find(s => ms >= s.startMs && ms <= s.endMs)?.text ?? '')
  }, [store])

  const onMeta = () => { if (videoRef.current) setDuration(videoRef.current.duration) }

  const togglePlay = () => {
    const v = videoRef.current; if (!v) return
    v.paused ? (v.play(), setPlaying(true)) : (v.pause(), setPlaying(false))
  }

  const skip = (d: number) => {
    const v = videoRef.current
    if (v) v.currentTime = Math.max(0, Math.min(durationSec, v.currentTime + d))
  }

  const seekToMs = (ms: number) => {
    const v = videoRef.current; if (!v) return
    v.currentTime = ms / 1000
    v.paused && (v.play(), setPlaying(true))
  }

  const setVol = (val: number) => {
    setVolume(val); setMuted(val === 0)
    if (videoRef.current) videoRef.current.volume = val
  }

  const toggleMute = () => {
    const v = videoRef.current; if (!v) return
    v.muted = !v.muted; setMuted(v.muted)
  }

  const setSpd = (s: number) => {
    setSpeed(s); if (videoRef.current) videoRef.current.playbackRate = s
  }

  const toggleFs = () => {
    document.fullscreenElement
      ? document.exitFullscreen()
      : containerRef.current?.requestFullscreen()
  }

  useEffect(() => {
    const h = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', h)
    return () => document.removeEventListener('fullscreenchange', h)
  }, [])

  // ── File load ──────────────────────────────────────────────────────────
  const loadFile = (f: File) => {
    store.reset(); store.setMediaFile(f)
    setPlaying(false); setCurrentSec(0); setSubtitle('')
  }
  const onInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (f) loadFile(f); e.target.value = ''
  }
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]; if (f) loadFile(f)
  }

  // ── Analyse ────────────────────────────────────────────────────────────
  const analyse = async () => {
    if (!store.mediaFile || !isReady('transcribe')) return
    store.setStage('audio', 0)
    try {
      const fp: string = (store.mediaFile as any).path ?? store.mediaFile.name
      const { sessionId } = await mediaApi.analyze(fp)
      store.setSessionId(sessionId)
      const hub = await joinSession(sessionId)
      hub.off('AnalysisProgress'); hub.off('TranscriptSegment')
      hub.off('AnalysisComplete'); hub.off('AnalysisError')

      hub.on('AnalysisProgress', (d: { stage: string; percent: number }) =>
        store.setStage(d.stage as any, d.percent))
      hub.on('TranscriptSegment', (seg: SpeakerSegment) => store.addSegment(seg))
      hub.on('AnalysisComplete', async () => {
        store.setStage('done', 100)
        const [sr, sumr] = await Promise.allSettled([
          transcriptApi.getSentiment(sessionId),
          transcriptApi.getSummary(sessionId),
        ])
        if (sr.status   === 'fulfilled') store.setSentiment(sr.value as SentimentResult)
        if (sumr.status === 'fulfilled') store.setSummary(sumr.value as SummaryResult)
        leaveSession(sessionId); refreshModels()
      })
      hub.on('AnalysisError', (d: { error: string }) => {
        store.setError(d.error); leaveSession(sessionId)
      })
    } catch (e: any) {
      store.setError(e?.response?.data?.error ?? e?.message ?? 'Unknown error')
    }
  }

  const STAGE_LABEL: Record<string, string> = {
    idle: '', audio: 'Loading audio…', vad: 'Detecting speech…',
    asr: 'Transcribing…', diarization: 'Identifying speakers…',
    sentiment: 'Analysing sentiment…', saving: 'Saving…',
    summary: 'Summarising…', done: 'Complete', error: 'Error',
  }

  const isAnalysing    = !['idle', 'done', 'error'].includes(store.stage)
  const canAnalyse     = !!store.mediaFile && store.stage === 'idle' && isReady('transcribe')
  const needsModel     = !!store.mediaFile && store.stage === 'idle' && !isReady('transcribe')
  const totalDurMs     = durationSec * 1000

  const TABS: { id: Tab; label: string }[] = [
    { id: 'transcript', label: 'Transcript' },
    { id: 'sentiment',  label: 'Sentiment'  },
    { id: 'summary',    label: 'Summary'    },
    { id: 'cli',        label: '🤖 Ask AI'  },
  ]

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      style={{
        height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column',
        background: P.bg, color: P.text, overflow: 'hidden',
      }}
    >
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div style={{ background: P.bar, borderBottom: `1px solid ${P.border}`, flexShrink: 0 }}>
        <div style={{
          maxWidth: 1400, margin: '0 auto', padding: '0 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 44,
        }}>
          <Link to="/landing" style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: 0.75, textDecoration: 'none', color: P.text }}>
            <img src="/owlia.svg" alt="OWLIA" style={{ width: 22, height: 22 }} />
            <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>OWLIA</span>
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: '0.72rem' }}>
            {isAnalysing && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: P.muted }}>
                <Loader2 size={11} className="animate-spin" />
                {STAGE_LABEL[store.stage]} {store.progress}%
              </span>
            )}
            {store.stage === 'error' && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#f87171' }}>
                <AlertCircle size={11} /> {store.error}
              </span>
            )}
            <Link to="/history"  style={{ opacity: 0.55, textDecoration: 'none', color: P.text }}>History</Link>
            <Link to="/download" style={{ opacity: 0.55, textDecoration: 'none', color: P.text }}>Download</Link>
          </div>
        </div>
      </div>

      {/* ── Main centred column ─────────────────────────────────────────── */}
      <div style={{ flex: '1 1 0', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{
          maxWidth: 1400, width: '100%', margin: '0 auto',
          padding: '0 clamp(12px, 3vw, 40px)',
          flex: '1 1 0', minHeight: 0, display: 'flex', flexDirection: 'column',
        }}>

          {/* ── Player ────────────────────────────────────────────────── */}
          <div
            style={{
              position: 'relative', flex: '1 1 0', minHeight: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#080604', borderRadius: 12, marginTop: 16,
              overflow: 'hidden', cursor: store.mediaUrl ? 'default' : 'pointer',
            }}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => !store.mediaUrl && fileInputRef.current?.click()}
          >
            {dragging && (
              <div style={{
                position: 'absolute', inset: 0, zIndex: 50,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `2px dashed ${P.accent}`, borderRadius: 12,
                background: 'rgba(242,163,91,0.06)',
              }}>
                <p style={{ color: P.accent, fontWeight: 600, fontSize: '1rem' }}>Drop media file</p>
              </div>
            )}

            {store.mediaUrl ? (
              <video
                ref={videoRef} src={store.mediaUrl}
                style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8 }}
                onTimeUpdate={onTimeUpdate} onLoadedMetadata={onMeta}
                onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, opacity: 0.28 }}>
                <img src="/owlia.svg" alt="" style={{ width: 56, height: 56 }} />
                <p style={{ fontSize: '0.85rem' }}>Drag a file here or click Add Media</p>
              </div>
            )}

            {/* Subtitle */}
            {subtitle && (
              <div style={{
                position: 'absolute', bottom: 48, left: '50%', transform: 'translateX(-50%)',
                maxWidth: '75%', background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(8px)',
                borderRadius: 10, padding: '6px 16px', fontSize: '0.9rem',
                fontWeight: 500, color: '#f5dbb8', textAlign: 'center', pointerEvents: 'none',
              }}>
                {subtitle}
              </div>
            )}
          </div>

          {/* ── Spectrum ──────────────────────────────────────────────── */}
          <div style={{ height: 44, background: '#080604', borderTop: `1px solid ${P.border}`, borderRadius: '0 0 4px 4px', marginBottom: 0 }}>
            <VoiceSpectrum mediaRef={videoRef} isPlaying={playing} height={44} barColor={P.accent} barCount={80} />
          </div>

          {/* ── Controls ──────────────────────────────────────────────── */}
          <div style={{ background: P.bar, borderRadius: 10, padding: '8px 16px', marginTop: 8, flexShrink: 0 }}>
            {/* Seek bar */}
            <input
              type="range" min={0} max={durationSec || 100} step={0.1} value={currentSec}
              style={{ width: '100%', accentColor: P.accent, height: 3, marginBottom: 8, display: 'block', cursor: 'pointer' }}
              onChange={e => { const v = +e.target.value; setCurrentSec(v); if (videoRef.current) videoRef.current.currentTime = v }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {/* Transport */}
              <button onClick={() => skip(-10)} style={iconBtn(P.text)} title="−10s"><SkipBack size={16} /></button>
              <button onClick={togglePlay}
                style={{ ...iconBtn(P.text), width: 36, height: 36, borderRadius: '50%', background: `${P.accent}22` }}>
                {playing ? <Pause size={18} /> : <Play size={18} />}
              </button>
              <button onClick={() => skip(10)} style={iconBtn(P.text)} title="+10s"><SkipForward size={16} /></button>

              <span style={{ fontSize: '0.72rem', fontFamily: 'monospace', opacity: 0.5, marginLeft: 4 }}>
                {fmtTime(currentSec)} / {fmtTime(durationSec)}
              </span>

              <select
                value={speed} onChange={e => setSpd(+e.target.value)}
                style={{ background: 'transparent', border: 'none', color: P.text, fontSize: '0.72rem', opacity: 0.65, cursor: 'pointer' }}
              >
                {[0.5, 0.75, 1, 1.25, 1.5, 2, 3].map(s => (
                  <option key={s} value={s} style={{ background: P.bar }}>{s}×</option>
                ))}
              </select>

              <div style={{ flex: 1 }} />

              {/* Volume */}
              <button onClick={toggleMute} style={iconBtn(P.text)}>
                {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
              </button>
              <input type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume}
                style={{ width: 72, accentColor: P.accent, cursor: 'pointer' }}
                onChange={e => setVol(+e.target.value)} />

              {/* Action buttons */}
              {canAnalyse && (
                <button onClick={analyse}
                  style={{ background: P.accent, color: '#1a1210', border: 'none', borderRadius: 100, padding: '5px 16px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                  Analyse
                </button>
              )}
              {needsModel && (
                <Link to="/download"
                  style={{ background: '#875d54', color: '#f5dbb8', borderRadius: 100, padding: '5px 14px', fontSize: '0.75rem', fontWeight: 600, textDecoration: 'none' }}
                  title="Whisper + VAD models required">
                  ⚠ Models needed
                </Link>
              )}

              <button onClick={() => fileInputRef.current?.click()}
                style={{ ...iconBtn(P.text), border: `1px solid ${P.border}`, borderRadius: 100, padding: '4px 12px', fontSize: '0.72rem', gap: 5, display: 'flex', alignItems: 'center' }}>
                <Plus size={12} /> Add Media
              </button>
              <input ref={fileInputRef} type="file" accept="audio/*,video/*" style={{ display: 'none' }} onChange={onInput} />

              <button onClick={toggleFs} style={iconBtn(P.text)}>
                {fullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
              </button>
            </div>
          </div>

          {/* Analysis progress */}
          {isAnalysing && (
            <div style={{ padding: '2px 0 4px' }}>
              <ProgressBar value={store.progress} color={P.accent} className="h-[2px]" />
              <p style={{ textAlign: 'right', fontSize: '0.65rem', opacity: 0.35, marginTop: 2 }}>
                {STAGE_LABEL[store.stage]}
              </p>
            </div>
          )}

          {/* ── Tabs + panel ──────────────────────────────────────────── */}
          <div style={{
            display: 'flex', flexDirection: 'column', flex: '0 0 300px',
            minHeight: 260, marginTop: 10, marginBottom: 16,
            background: P.surface, borderRadius: 12, border: `1px solid ${P.border}`, overflow: 'hidden',
          }}>
            {/* Tab bar */}
            <div style={{ display: 'flex', borderBottom: `1px solid ${P.border}`, background: P.panel, flexShrink: 0 }}>
              {TABS.map(t => (
                <button
                  key={t.id} type="button" onClick={() => setTab(t.id)}
                  style={{
                    padding: '10px 16px', fontSize: '0.78rem', fontWeight: 600,
                    background: 'none', border: 'none', cursor: 'pointer',
                    color:        tab === t.id ? P.accent : P.muted,
                    borderBottom: tab === t.id ? `2px solid ${P.accent}` : '2px solid transparent',
                    transition: 'color 0.15s',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', ...DARK_VARS }}>
              {tab === 'transcript' && (
                <ModelGate feature="transcribe">
                  <TranscriptList segments={store.segments} activeIndex={store.activeSegmentIndex} onSeek={seekToMs} />
                </ModelGate>
              )}
              {tab === 'sentiment' && (
                <ModelGate feature="sentiment">
                  <SentimentView sentiment={store.sentiment} totalDurationMs={totalDurMs} />
                </ModelGate>
              )}
              {tab === 'summary' && (
                <ModelGate feature="summary">
                  <SummaryView summary={store.summary} />
                </ModelGate>
              )}
              {tab === 'cli' && <CliPanel sessionId={store.sessionId} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Small reusable button style helper
function iconBtn(textColor: string): React.CSSProperties {
  return {
    background: 'none', border: 'none', color: textColor,
    cursor: 'pointer', opacity: 0.65, display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 4, borderRadius: 6, transition: 'opacity 0.15s',
  }
}
