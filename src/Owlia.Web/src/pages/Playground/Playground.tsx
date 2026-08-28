import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Maximize, Minimize, Plus, ChevronDown,
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
import { Nav } from '../../components/Nav/Nav'
import type { SpeakerSegment, SentimentResult, SummaryResult } from '../../api/client'

type Tab = 'transcript' | 'sentiment' | 'summary' | 'cli'

function fmtTime(sec: number) {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

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
  const [speedOpen, setSpeedOpen]   = useState(false)
  const speedRef                    = useRef<HTMLDivElement>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [subtitle, setSubtitle]     = useState('')
  const [dragging, setDragging]     = useState(false)

  useEffect(() => { refreshModels() }, [refreshModels])

  // Close speed dropdown on outside click
  useEffect(() => {
    if (!speedOpen) return
    const handler = (e: MouseEvent) => {
      if (speedRef.current && !speedRef.current.contains(e.target as Node)) setSpeedOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [speedOpen])

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
        background: 'var(--bg)', color: 'var(--text)', overflow: 'hidden',
      }}
    >
      {/* ── Shared nav ──────────────────────────────────────────────────── */}
      <Nav />

      {/* ── Video area ──────────────────────────────────────────────────── */}
      <div
        style={{
          position: 'relative', height: '35vh', minHeight: 180, flexShrink: 0,
          margin: '8px clamp(12px, 3vw, 40px) 0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--player-bg)', borderRadius: 10,
          overflow: 'hidden', cursor: store.mediaUrl ? 'default' : 'pointer',
          border: '1px solid var(--border)',
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
            border: '2px dashed var(--accent)', borderRadius: 10,
            background: 'color-mix(in srgb, var(--accent) 6%, transparent)',
          }}>
            <p style={{ color: 'var(--accent)', fontWeight: 600, fontSize: '0.95rem' }}>Drop media file</p>
          </div>
        )}

        {store.mediaUrl ? (
          <video
            ref={videoRef} src={store.mediaUrl}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            onTimeUpdate={onTimeUpdate} onLoadedMetadata={onMeta}
            onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, opacity: 0.25 }}>
            <img src="/owlia.svg" alt="" style={{ width: 48, height: 48 }} />
            <p style={{ fontSize: '0.82rem' }}>Drag a file here or click Add Media</p>
          </div>
        )}

        {subtitle && (
          <div style={{
            position: 'absolute', bottom: 36, left: '50%', transform: 'translateX(-50%)',
            maxWidth: '75%', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)',
            borderRadius: 8, padding: '5px 14px', fontSize: '0.85rem',
            fontWeight: 500, color: 'var(--text)', textAlign: 'center', pointerEvents: 'none',
          }}>
            {subtitle}
          </div>
        )}
      </div>

      {/* ── Spectrum ──────────────────────────────────────────────────────── */}
      <div style={{ height: 28, flexShrink: 0, margin: '0 clamp(12px, 3vw, 40px)', background: 'var(--player-bg)', borderRadius: '0 0 6px 6px', marginTop: -1 }}>
        <VoiceSpectrum mediaRef={videoRef} isPlaying={playing} height={28} barColor="var(--accent)" barCount={80} />
      </div>

      {/* ── Controls ──────────────────────────────────────────────────────── */}
      <div style={{ flexShrink: 0, margin: '6px clamp(12px, 3vw, 40px) 0', background: 'var(--surface)', borderRadius: 8, padding: '5px 14px' }}>
        <input
          type="range" min={0} max={durationSec || 100} step={0.1} value={currentSec}
          style={{ width: '100%', accentColor: 'var(--accent)', height: 2, marginBottom: 4, display: 'block', cursor: 'pointer' }}
          onChange={e => { const v = +e.target.value; setCurrentSec(v); if (videoRef.current) videoRef.current.currentTime = v }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={() => skip(-10)} style={iconBtn()} title="−10s"><SkipBack size={14} /></button>
          <button onClick={togglePlay}
            style={{ ...iconBtn(), width: 30, height: 30, borderRadius: '50%', background: 'color-mix(in srgb, var(--accent) 13%, transparent)' }}>
            {playing ? <Pause size={15} /> : <Play size={15} />}
          </button>
          <button onClick={() => skip(10)} style={iconBtn()} title="+10s"><SkipForward size={14} /></button>

          <span style={{ fontSize: '0.68rem', fontFamily: 'monospace', opacity: 0.45 }}>
            {fmtTime(currentSec)} / {fmtTime(durationSec)}
          </span>

          {/* Speed dropdown */}
          <div ref={speedRef} className="relative">
            <button
              type="button"
              onClick={() => setSpeedOpen(o => !o)}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.68rem] transition-colors"
              style={{
                color: 'var(--text)', opacity: 0.6, cursor: 'pointer',
                background: speedOpen ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
              }}
            >
              {speed}×
              <ChevronDown size={9} style={{ opacity: 0.5, transform: speedOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.15s' }} />
            </button>
            {speedOpen && (
              <div
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 py-1 rounded-lg shadow-lg z-50"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', minWidth: 52 }}
              >
                {[0.5, 0.75, 1, 1.25, 1.5, 2, 3].map(s => (
                  <button
                    key={s} type="button"
                    onClick={() => { setSpd(s); setSpeedOpen(false) }}
                    className="w-full text-left px-2.5 py-1 text-[0.68rem] transition-colors"
                    style={{
                      color: s === speed ? 'var(--accent)' : 'var(--text)',
                      fontWeight: s === speed ? 700 : 400,
                      background: s === speed ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
                    }}
                    onMouseEnter={e => { if (s !== speed) e.currentTarget.style.background = 'color-mix(in srgb, var(--text) 6%, transparent)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = s === speed ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent' }}
                  >
                    {s}×
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ flex: 1 }} />

          <button onClick={toggleMute} style={iconBtn()}>
            {muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
          </button>
          <input type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume}
            style={{ width: 56, accentColor: 'var(--accent)', cursor: 'pointer' }}
            onChange={e => setVol(+e.target.value)} />

          {canAnalyse && (
            <button onClick={analyse}
              style={{ background: 'var(--accent)', color: '#1a1210', border: 'none', borderRadius: 100, padding: '3px 12px', fontSize: '0.70rem', fontWeight: 700, cursor: 'pointer' }}>
              Analyse
            </button>
          )}
          {needsModel && (
            <Link to="/download"
              style={{ background: 'var(--accent-copper)', color: 'var(--text)', borderRadius: 100, padding: '3px 10px', fontSize: '0.70rem', fontWeight: 600, textDecoration: 'none' }}>
              ⚠ Models
            </Link>
          )}

          <button onClick={() => fileInputRef.current?.click()}
            style={{ ...iconBtn(), border: '1px solid var(--border)', borderRadius: 100, padding: '3px 8px', fontSize: '0.68rem', gap: 3, display: 'flex', alignItems: 'center' }}>
            <Plus size={10} /> Add
          </button>
          <input ref={fileInputRef} type="file" accept="audio/*,video/*" style={{ display: 'none' }} onChange={onInput} />

          <button onClick={toggleFs} style={iconBtn()}>
            {fullscreen ? <Minimize size={12} /> : <Maximize size={12} />}
          </button>
        </div>
      </div>

      {/* Analysis progress */}
      {isAnalysing && (
        <div style={{ flexShrink: 0, margin: '2px clamp(12px, 3vw, 40px) 0' }}>
          <ProgressBar value={store.progress} color="var(--accent)" className="h-[2px]" />
          <p style={{ textAlign: 'right', fontSize: '0.60rem', opacity: 0.3, marginTop: 1 }}>
            {STAGE_LABEL[store.stage]}
          </p>
        </div>
      )}

      {/* ── Tabs panel — fills remaining height, scrolls internally ─────── */}
      <div style={{
        flex: '1 1 0', minHeight: 0,
        display: 'flex', flexDirection: 'column',
        margin: '6px clamp(12px, 3vw, 40px) clamp(6px, 1vw, 12px)',
        background: 'var(--surface)', borderRadius: 10,
        border: '1px solid var(--border)', overflow: 'hidden',
      }}>
        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)', flexShrink: 0 }}>
          {TABS.map(t => (
            <button
              key={t.id} type="button" onClick={() => setTab(t.id)}
              style={{
                padding: '8px 14px', fontSize: '0.75rem', fontWeight: 600,
                background: 'none', border: 'none', cursor: 'pointer',
                color:        tab === t.id ? 'var(--accent)' : 'var(--text-muted)',
                borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
                transition: 'color 0.15s', whiteSpace: 'nowrap',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content — scrolls */}
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
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
  )
}

function iconBtn(): React.CSSProperties {
  return {
    background: 'none', border: 'none', color: 'var(--text)',
    cursor: 'pointer', opacity: 0.6, display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 3, borderRadius: 5, transition: 'opacity 0.15s',
  }
}
