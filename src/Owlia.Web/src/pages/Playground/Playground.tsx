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

function fmtTime(sec: number) {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function Playground() {
  const store = usePlaygroundStore()
  const { refresh: refreshModels, isReady } = useModelStore()
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [tab, setTab] = useState<Tab>('transcript')
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [currentSec, setCurrentSec] = useState(0)
  const [durationSec, setDurationSec] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [fullscreen, setFullscreen] = useState(false)
  const [subtitleText, setSubtitleText] = useState('')
  const [isDraggingOver, setIsDraggingOver] = useState(false)

  // Refresh model status on mount
  useEffect(() => { refreshModels() }, [refreshModels])

  // ── Session restore (from History page) ───────────────────────────────
  useEffect(() => {
    const { sessionId, segments } = store
    if (sessionId && segments.length === 0) {
      // Restore transcript, sentiment, summary from API
      Promise.allSettled([
        transcriptApi.get(sessionId),
        transcriptApi.getSentiment(sessionId),
        transcriptApi.getSummary(sessionId),
      ]).then(([tRes, sRes, sumRes]) => {
        if (tRes.status === 'fulfilled' && tRes.value?.segments?.length) {
          store.setSegments(tRes.value.segments)
        }
        if (sRes.status === 'fulfilled' && sRes.value) {
          store.setSentiment(sRes.value as SentimentResult)
        }
        if (sumRes.status === 'fulfilled' && sumRes.value) {
          store.setSummary(sumRes.value as SummaryResult)
        }
        if (tRes.status === 'fulfilled' && tRes.value?.segments?.length) {
          store.setStage('done', 100)
        }
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // run once on mount

  // ── Player events ──────────────────────────────────────────────────────
  const onTimeUpdate = useCallback(() => {
    const vid = videoRef.current
    if (!vid) return
    const ms = vid.currentTime * 1000
    setCurrentSec(vid.currentTime)
    store.setCurrentTimeMs(ms)
    const active = store.segments.find(s => ms >= s.startMs && ms <= s.endMs)
    setSubtitleText(active?.text ?? '')
  }, [store])

  const onLoadedMetadata = () => {
    if (videoRef.current) setDurationSec(videoRef.current.duration)
  }

  const togglePlay = () => {
    const vid = videoRef.current
    if (!vid) return
    if (vid.paused) { vid.play(); setPlaying(true) }
    else { vid.pause(); setPlaying(false) }
  }

  const seek = (delta: number) => {
    const vid = videoRef.current
    if (vid) vid.currentTime = Math.max(0, Math.min(durationSec, vid.currentTime + delta))
  }

  const seekToMs = (ms: number) => {
    const vid = videoRef.current
    if (!vid) return
    vid.currentTime = ms / 1000
    if (vid.paused) { vid.play(); setPlaying(true) }
  }

  const onVolumeChange = (v: number) => {
    setVolume(v); setMuted(v === 0)
    if (videoRef.current) videoRef.current.volume = v
  }

  const toggleMute = () => {
    const vid = videoRef.current
    if (!vid) return
    vid.muted = !vid.muted; setMuted(vid.muted)
  }

  const onSpeedChange = (s: number) => {
    setSpeed(s)
    if (videoRef.current) videoRef.current.playbackRate = s
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen(); setFullscreen(true)
    } else {
      document.exitFullscreen(); setFullscreen(false)
    }
  }

  useEffect(() => {
    const h = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', h)
    return () => document.removeEventListener('fullscreenchange', h)
  }, [])

  // ── File loading ───────────────────────────────────────────────────────
  const loadFile = (file: File) => {
    store.reset(); store.setMediaFile(file)
    setPlaying(false); setCurrentSec(0); setSubtitleText('')
  }

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (f) loadFile(f); e.target.value = ''
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDraggingOver(false)
    const f = e.dataTransfer.files[0]; if (f) loadFile(f)
  }

  // ── Analysis ───────────────────────────────────────────────────────────
  const analyse = async () => {
    if (!store.mediaFile || !isReady('transcribe')) return
    store.setStage('audio', 0)
    try {
      // Photino exposes the real FS path on `file.path` (non-standard Web API property)
      const filePath: string = (store.mediaFile as any).path ?? store.mediaFile.name
      const { sessionId } = await mediaApi.analyze(filePath)
      store.setSessionId(sessionId)
      const hub = await joinSession(sessionId)

      // Remove any stale handlers before registering new ones
      hub.off('AnalysisProgress')
      hub.off('TranscriptSegment')
      hub.off('AnalysisComplete')
      hub.off('AnalysisError')

      hub.on('AnalysisProgress', (data: { stage: string; percent: number }) => {
        store.setStage(data.stage as any, data.percent)
      })
      hub.on('TranscriptSegment', (seg: SpeakerSegment) => {
        store.addSegment(seg)
      })
      hub.on('AnalysisComplete', async () => {
        store.setStage('done', 100)
        const [sRes, sumRes] = await Promise.allSettled([
          transcriptApi.getSentiment(sessionId),
          transcriptApi.getSummary(sessionId),
        ])
        if (sRes.status === 'fulfilled') store.setSentiment(sRes.value as SentimentResult)
        if (sumRes.status === 'fulfilled') store.setSummary(sumRes.value as SummaryResult)
        leaveSession(sessionId)
        refreshModels()
      })
      hub.on('AnalysisError', (data: { error: string }) => {
        store.setError(data.error)
        leaveSession(sessionId)
      })
    } catch (err: any) {
      store.setError(err?.response?.data?.error ?? err?.message ?? 'Unknown error')
    }
  }

  const stageLabel: Record<string, string> = {
    idle: '', audio: 'Loading audio…', vad: 'Detecting speech…', asr: 'Transcribing…',
    diarization: 'Identifying speakers…', sentiment: 'Analysing sentiment…',
    saving: 'Saving…', summary: 'Summarising…', done: 'Complete', error: 'Error',
  }

  const isAnalysing = !['idle', 'done', 'error'].includes(store.stage)
  const totalDurationMs = durationSec * 1000
  const canAnalyse = !!store.mediaFile && store.stage === 'idle' && isReady('transcribe')
  const noTranscribeModel = store.mediaFile && store.stage === 'idle' && !isReady('transcribe')

  const TABS: { id: Tab; label: string }[] = [
    { id: 'transcript', label: 'Transcript' },
    { id: 'sentiment', label: 'Sentiment' },
    { id: 'summary', label: 'Summary' },
    { id: 'cli', label: '🤖 Ask AI' },
  ]

  return (
    <div
      ref={containerRef}
      className="flex h-screen w-screen flex-col"
      style={{ background: '#1a1210', color: '#f5dbb8' }}
    >
      {/* ── Top nav ── */}
      <div
        className="flex shrink-0 items-center justify-between px-4 py-2"
        style={{ borderBottom: '1px solid rgba(242,163,91,0.12)', background: '#2a1f1b' }}
      >
        <Link to="/landing" className="flex items-center gap-2 text-sm opacity-70 hover:opacity-100 transition-opacity">
          <img src="/owlia.svg" alt="OWLIA" className="h-6 w-6" />
          <span className="font-semibold">OWLIA</span>
        </Link>
        <div className="flex items-center gap-3 text-xs">
          {isAnalysing && (
            <span className="flex items-center gap-1.5" style={{ color: '#d0805f' }}>
              <Loader2 size={12} className="animate-spin" />
              {stageLabel[store.stage]} {store.progress}%
            </span>
          )}
          {store.stage === 'error' && (
            <span className="flex items-center gap-1.5 text-red-400">
              <AlertCircle size={12} /> {store.error}
            </span>
          )}
          <Link to="/history" className="opacity-60 hover:opacity-100 transition-opacity">History</Link>
          <Link to="/download" className="opacity-60 hover:opacity-100 transition-opacity">Download</Link>
        </div>
      </div>

      {/* ── Player area ── */}
      <div
        className="relative flex flex-col items-center justify-center overflow-hidden"
        style={{ background: '#0d0907', minHeight: 0, flex: '1 1 0' }}
        onDragOver={e => { e.preventDefault(); setIsDraggingOver(true) }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={onDrop}
      >
        {isDraggingOver && (
          <div className="absolute inset-0 z-50 flex items-center justify-center border-2 border-dashed border-[#f2a35b] bg-[#f2a35b08]">
            <p className="text-lg font-semibold text-[#f2a35b]">Drop media file here</p>
          </div>
        )}

        {store.mediaUrl ? (
          <video
            ref={videoRef}
            src={store.mediaUrl}
            className="max-h-full max-w-full"
            onTimeUpdate={onTimeUpdate}
            onLoadedMetadata={onLoadedMetadata}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
          />
        ) : (
          <div className="flex flex-col items-center gap-3 opacity-30">
            <img src="/owlia.svg" alt="" className="h-14 w-14" />
            <p className="text-sm">Drag a file here or click Add Media</p>
          </div>
        )}

        {/* Subtitle overlay */}
        {subtitleText && (
          <div
            className="absolute bottom-16 left-1/2 -translate-x-1/2 max-w-2xl rounded-xl px-5 py-2 text-center text-base font-medium"
            style={{ background: 'rgba(0,0,0,0.74)', color: '#f5dbb8', backdropFilter: 'blur(6px)' }}
          >
            {subtitleText}
          </div>
        )}
      </div>

      {/* ── Spectrum visualizer ── */}
      <div style={{ background: '#0d0907', height: 52, borderTop: '1px solid rgba(242,163,91,0.07)' }}>
        <VoiceSpectrum
          mediaRef={videoRef}
          isPlaying={playing}
          height={52}
          barColor="#f2a35b"
          barCount={80}
        />
      </div>

      {/* ── Controls bar ── */}
      <div
        className="shrink-0 px-4 py-2"
        style={{ background: '#2a1f1b', borderTop: '1px solid rgba(242,163,91,0.12)' }}
      >
        {/* Seek bar */}
        <input
          type="range" min={0} max={durationSec || 100} step={0.1} value={currentSec}
          className="mb-2 h-1 w-full cursor-pointer accent-[#f2a35b]"
          onChange={e => {
            const v = parseFloat(e.target.value)
            setCurrentSec(v)
            if (videoRef.current) videoRef.current.currentTime = v
          }}
        />

        <div className="flex items-center gap-3">
          <button type="button" onClick={() => seek(-10)} title="Back 10s" className="opacity-70 hover:opacity-100 transition-opacity">
            <SkipBack size={17} />
          </button>
          <button
            type="button" onClick={togglePlay}
            className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-[#f2a35b22]"
          >
            {playing ? <Pause size={20} /> : <Play size={20} />}
          </button>
          <button type="button" onClick={() => seek(10)} title="Forward 10s" className="opacity-70 hover:opacity-100 transition-opacity">
            <SkipForward size={17} />
          </button>

          <span className="text-xs font-mono opacity-60">
            {fmtTime(currentSec)} / {fmtTime(durationSec)}
          </span>

          <select
            value={speed}
            onChange={e => onSpeedChange(parseFloat(e.target.value))}
            className="rounded bg-transparent text-xs opacity-70 hover:opacity-100"
            style={{ color: '#f5dbb8' }}
          >
            {[0.5, 0.75, 1, 1.25, 1.5, 2, 3].map(s => (
              <option key={s} value={s} style={{ background: '#2a1f1b' }}>{s}×</option>
            ))}
          </select>

          <div className="flex-1" />

          <button type="button" onClick={toggleMute} className="opacity-70 hover:opacity-100 transition-opacity">
            {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>
          <input
            type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume}
            className="w-20 accent-[#f2a35b]"
            onChange={e => onVolumeChange(parseFloat(e.target.value))}
          />

          {/* Analyse / gated */}
          {canAnalyse && (
            <button
              type="button" onClick={analyse}
              className="rounded-full px-4 py-1.5 text-xs font-semibold transition-all hover:brightness-110 active:scale-95"
              style={{ background: '#f2a35b', color: '#1a1210' }}
            >
              Analyse
            </button>
          )}
          {noTranscribeModel && (
            <Link
              to="/download"
              className="rounded-full px-4 py-1.5 text-xs font-semibold transition-all hover:brightness-110"
              style={{ background: '#875d54', color: '#f5dbb8' }}
              title="Whisper + Silero VAD models required"
            >
              ⚠ Models needed
            </Link>
          )}

          <button
            type="button" onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium opacity-70 hover:opacity-100 transition-opacity"
            style={{ border: '1px solid rgba(242,163,91,0.3)' }}
          >
            <Plus size={13} /> Add Media
          </button>
          <input ref={fileInputRef} type="file" accept="audio/*,video/*" className="hidden" onChange={onFileInput} />

          <button type="button" onClick={toggleFullscreen} className="opacity-70 hover:opacity-100 transition-opacity">
            {fullscreen ? <Minimize size={15} /> : <Maximize size={15} />}
          </button>
        </div>
      </div>

      {/* ── Analysis progress bar ── */}
      {isAnalysing && (
        <div className="shrink-0 px-4 pb-1" style={{ background: '#2a1f1b' }}>
          <ProgressBar value={store.progress} color="#f2a35b" className="h-[3px]" />
          <p className="mt-0.5 text-right text-[10px] opacity-40">{stageLabel[store.stage]}</p>
        </div>
      )}

      {/* ── Tabs ── */}
      <div
        className="flex shrink-0 gap-1 px-3"
        style={{ borderBottom: '1px solid rgba(242,163,91,0.12)', background: '#2a1f1b' }}
      >
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className="pb-2 pt-3 px-2 text-xs font-medium transition-colors whitespace-nowrap"
            style={{
              color: tab === t.id ? '#f2a35b' : '#878787',
              borderBottom: tab === t.id ? '2px solid #f2a35b' : '2px solid transparent',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div
        className="min-h-0 flex-1 overflow-hidden"
        style={{ background: '#1e1613', color: '#f5dbb8', '--text': '#f5dbb8', '--text-muted': '#d0805f', '--surface': '#2a1f1b', '--surface-2': '#3a2c26', '--border': 'rgba(242,163,91,0.14)', '--accent': '#f2a35b' } as React.CSSProperties}
      >
        {tab === 'transcript' && (
          <ModelGate feature="transcribe">
            <TranscriptList
              segments={store.segments}
              activeIndex={store.activeSegmentIndex}
              onSeek={seekToMs}
            />
          </ModelGate>
        )}
        {tab === 'sentiment' && (
          <ModelGate feature="sentiment">
            <SentimentView sentiment={store.sentiment} totalDurationMs={totalDurationMs} />
          </ModelGate>
        )}
        {tab === 'summary' && (
          <ModelGate feature="summary">
            <SummaryView summary={store.summary} />
          </ModelGate>
        )}
        {tab === 'cli' && (
          <CliPanel sessionId={store.sessionId} />
        )}
      </div>
    </div>
  )
}
