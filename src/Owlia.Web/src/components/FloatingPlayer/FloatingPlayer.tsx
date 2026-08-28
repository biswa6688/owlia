import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Minimize2, Maximize2, Plus, ChevronDown, GripHorizontal,
  Square, Video,
} from 'lucide-react'
import WaveSurfer from 'wavesurfer.js'
import { Spectrogram } from '../Spectrogram/Spectrogram'

interface Props {
  mediaUrl: string | null
  mediaFile: File | null
  subtitle: string
  onFileLoad: (file: File) => void
  onSeek: (ms: number) => void
  onAnalyse?: () => void
  canAnalyse?: boolean
  needsModel?: boolean
  isAnalysing?: boolean
  stageLabel?: string
  progress?: number
}

function fmtTime(sec: number) {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function FloatingPlayer({
  mediaUrl, mediaFile, subtitle, onFileLoad, onSeek,
  onAnalyse, canAnalyse, needsModel, isAnalysing, stageLabel, progress,
}: Props) {
  const videoRef     = useRef<HTMLVideoElement>(null)
  const wsRef        = useRef<WaveSurfer | null>(null)
  const wsContainer  = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragRef      = useRef<HTMLDivElement>(null)

  // Player state
  const [playing, setPlaying]       = useState(false)
  const [muted, setMuted]           = useState(false)
  const [volume, setVolume]         = useState(1)
  const [currentSec, setCurrentSec] = useState(0)
  const [durationSec, setDuration]  = useState(0)
  const [speed, setSpeed]           = useState(1)
  const [speedOpen, setSpeedOpen]   = useState(false)
  const speedRef                    = useRef<HTMLDivElement>(null)
  const [showSpectrogram, setShowSpectrogram] = useState(false)

  // Window state
  const [minimized, setMinimized] = useState(false)
  const [position, setPosition]   = useState({ x: 0, y: 0 })
  const [size, setSize]           = useState({ w: 420, h: 0 }) // h=0 means auto
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [maximized, setMaximized] = useState(false)
  const [draggingFile, setDraggingFile] = useState(false)
  const [ready, setReady] = useState(false)

  const savedPos = useRef({ x: 0, y: 0 })
  const savedSize = useRef({ w: 420, h: 0 })

  // Centre window on mount
  useEffect(() => {
    setPosition({ x: Math.max(20, window.innerWidth - 460), y: 60 })
  }, [])

  // ── WaveSurfer ───────────────────────────────────────────────────────
  useEffect(() => {
    const el = wsContainer.current
    if (!el || wsRef.current) return

    const ws = WaveSurfer.create({
      container: el,
      waveColor: 'rgba(242,163,91,0.22)',
      progressColor: 'rgba(242,163,91,0.85)',
      cursorColor: '#feb903',
      cursorWidth: 2,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 32,
      normalize: true,
      interact: true,
      fillParent: true,
      minPxPerSec: 60,
    })

    ws.on('interaction', (t: number) => {
      if (videoRef.current) {
        videoRef.current.currentTime = t
        videoRef.current.play()
        setPlaying(true)
      }
    })
    ws.on('ready', () => setReady(true))
    wsRef.current = ws

    return () => { ws.destroy(); wsRef.current = null; setReady(false) }
  }, [])

  // Load src into WaveSurfer
  useEffect(() => {
    const ws = wsRef.current
    if (!ws || !mediaUrl) return
    ws.load(mediaUrl)
  }, [mediaUrl])

  // Sync waveform position
  useEffect(() => {
    const ws = wsRef.current
    if (!ws || !ready) return
    const dur = ws.getDuration() || 1
    ws.seekTo(currentSec / dur)
  }, [currentSec, ready])

  // ── Video callbacks ──────────────────────────────────────────────────
  const onTimeUpdate = useCallback(() => {
    const v = videoRef.current; if (!v) return
    setCurrentSec(v.currentTime)
    onSeek(v.currentTime * 1000)
  }, [onSeek])

  const onMeta = () => {
    if (videoRef.current) setDuration(videoRef.current.duration)
  }

  const togglePlay = () => {
    const v = videoRef.current; if (!v) return
    v.paused ? (v.play(), setPlaying(true)) : (v.pause(), setPlaying(false))
  }

  const skip = (d: number) => {
    const v = videoRef.current
    if (v) v.currentTime = Math.max(0, Math.min(durationSec, v.currentTime + d))
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

  // ── Drag (title bar) ────────────────────────────────────────────────
  const onDragStart = useCallback((e: React.MouseEvent) => {
    if (maximized) return
    setIsDragging(true)
    savedPos.current = { x: e.clientX - position.x, y: e.clientY - position.y }
    e.preventDefault()
  }, [position, maximized])

  useEffect(() => {
    if (!isDragging) return
    const move = (e: MouseEvent) => {
      setPosition({ x: e.clientX - savedPos.current.x, y: e.clientY - savedPos.current.y })
    }
    const up = () => setIsDragging(false)
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
    return () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up) }
  }, [isDragging])

  // ── Resize (bottom-right corner) ────────────────────────────────────
  const onResizeStart = useCallback((e: React.MouseEvent) => {
    if (maximized) return
    setIsResizing(true)
    savedSize.current = { w: size.w, h: size.h || 380 }
    savedPos.current  = { x: e.clientX, y: e.clientY }
    e.preventDefault()
    e.stopPropagation()
  }, [size, maximized])

  useEffect(() => {
    if (!isResizing) return
    const move = (e: MouseEvent) => {
      const dw = e.clientX - savedPos.current.x
      const dh = e.clientY - savedPos.current.y
      setSize({ w: Math.max(340, savedSize.current.w + dw), h: Math.max(260, savedSize.current.h + dh) })
    }
    const up = () => setIsResizing(false)
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
    return () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up) }
  }, [isResizing])

  // ── Maximize toggle ─────────────────────────────────────────────────
  const toggleMaximize = () => {
    if (maximized) {
      setPosition(savedPos.current)
      setSize(savedSize.current)
      setMaximized(false)
    } else {
      savedPos.current = { ...position }
      savedSize.current = { ...size }
      setPosition({ x: 0, y: 0 })
      setSize({ w: window.innerWidth, h: window.innerHeight })
      setMaximized(true)
    }
  }

  // Click-outside speed dropdown
  useEffect(() => {
    if (!speedOpen) return
    const h = (e: MouseEvent) => { if (speedRef.current && !speedRef.current.contains(e.target as Node)) setSpeedOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [speedOpen])

  // ── File drop on window ─────────────────────────────────────────────
  const onWindowDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDraggingFile(false)
    const f = e.dataTransfer.files[0]; if (f) onFileLoad(f)
  }

  const windowStyle: React.CSSProperties = maximized
    ? { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 100 }
    : { position: 'fixed', top: position.y, left: position.x, width: size.w, zIndex: 100 }

  return (
    <div
      style={{
        ...windowStyle,
        display: 'flex', flexDirection: 'column',
        background: 'var(--bg)', color: 'var(--text)',
        borderRadius: maximized ? 0 : 12,
        border: '1px solid var(--border)',
        boxShadow: maximized ? 'none' : '0 12px 40px rgba(0,0,0,0.35), 0 0 0 1px var(--border)',
        overflow: 'hidden',
        transition: isDragging || isResizing ? 'none' : 'border-radius 0.2s',
        userSelect: isDragging || isResizing ? 'none' : 'auto',
      }}
      onDragOver={e => { e.preventDefault(); setDraggingFile(true) }}
      onDragLeave={() => setDraggingFile(false)}
      onDrop={onWindowDrop}
    >
      {/* ── Title bar (drag handle) ──────────────────────────────────── */}
      <div
        ref={dragRef}
        onMouseDown={onDragStart}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 10px', flexShrink: 0,
          background: 'var(--surface)', borderBottom: '1px solid var(--border)',
          cursor: isDragging ? 'grabbing' : 'grab',
        }}
      >
        <GripHorizontal size={12} style={{ opacity: 0.3, flexShrink: 0 }} />
        <Video size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        <span style={{ fontSize: '0.70rem', fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {mediaFile?.name || 'Media Player'}
        </span>

        {/* Status dot */}
        {isAnalysing && (
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', animation: 'pulse-dot 1.6s ease-in-out infinite', flexShrink: 0 }} />
        )}

        {/* Window controls */}
        <button
          onClick={() => setMinimized(v => !v)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', opacity: 0.5, padding: 2, display: 'flex' }}
          title={minimized ? 'Restore' : 'Minimize'}
        >
          <Minimize2 size={12} />
        </button>
        <button
          onClick={toggleMaximize}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', opacity: 0.5, padding: 2, display: 'flex' }}
          title={maximized ? 'Restore' : 'Maximize'}
        >
          {maximized ? <Square size={11} /> : <Maximize2 size={12} />}
        </button>
      </div>

      {/* ── Body (hidden when minimized) ─────────────────────────────── */}
      {!minimized && (
        <div style={{ flex: '1 1 0', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Drop overlay */}
          {draggingFile && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 50,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'color-mix(in srgb, var(--accent) 8%, var(--bg))',
              border: '2px dashed var(--accent)', borderRadius: 10,
            }}>
              <p style={{ color: 'var(--accent)', fontWeight: 600, fontSize: '0.85rem' }}>Drop media file</p>
            </div>
          )}

          {/* ── Video ──────────────────────────────────────────────────── */}
          <div style={{ position: 'relative', flex: '1 1 0', minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--player-bg)', overflow: 'hidden' }}>
            {mediaUrl ? (
              <video
                ref={videoRef} src={mediaUrl}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                onTimeUpdate={onTimeUpdate} onLoadedMetadata={onMeta}
                onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
              />
            ) : (
              <div
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, opacity: 0.2, cursor: 'pointer', padding: 20 }}
                onClick={() => fileInputRef.current?.click()}
              >
                <Video size={32} />
                <p style={{ fontSize: '0.78rem' }}>Drop or click to load</p>
              </div>
            )}

            {subtitle && (
              <div style={{
                position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
                maxWidth: '80%', background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(4px)',
                borderRadius: 6, padding: '3px 10px', fontSize: '0.78rem',
                fontWeight: 500, color: 'var(--text)', textAlign: 'center', pointerEvents: 'none', zIndex: 5,
              }}>
                {subtitle}
              </div>
            )}

            <Spectrogram mediaRef={videoRef} visible={showSpectrogram} />
          </div>

          {/* ── Waveform ───────────────────────────────────────────────── */}
          <div style={{ flexShrink: 0, padding: '2px 8px', background: 'var(--player-bg)', borderTop: '1px solid var(--border)' }}>
            <div ref={wsContainer} style={{ width: '100%' }} />
          </div>

          {/* ── Controls ───────────────────────────────────────────────── */}
          <div style={{ flexShrink: 0, padding: '4px 8px 6px', background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
            {/* Seek bar */}
            <input
              type="range" min={0} max={durationSec || 100} step={0.1} value={currentSec}
              style={{ width: '100%', accentColor: 'var(--accent)', height: 2, display: 'block', cursor: 'pointer' }}
              onChange={e => { const v = +e.target.value; setCurrentSec(v); if (videoRef.current) videoRef.current.currentTime = v }}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
              {/* Transport */}
              <button onClick={() => skip(-10)} style={btn()} title="−10s"><SkipBack size={12} /></button>
              <button onClick={togglePlay} style={{ ...btn(), width: 26, height: 26, borderRadius: '50%', background: 'color-mix(in srgb, var(--accent) 13%, transparent)' }}>
                {playing ? <Pause size={13} /> : <Play size={13} />}
              </button>
              <button onClick={() => skip(10)} style={btn()} title="+10s"><SkipForward size={12} /></button>

              <span style={{ fontSize: '0.62rem', fontFamily: 'monospace', opacity: 0.4, minWidth: 64, textAlign: 'center' }}>
                {fmtTime(currentSec)} / {fmtTime(durationSec)}
              </span>

              {/* Speed */}
              <div ref={speedRef} className="relative">
                <button
                  type="button" onClick={() => setSpeedOpen(o => !o)}
                  className="flex items-center gap-0.5 rounded px-1 py-0.5 text-[0.62rem] transition-colors"
                  style={{ color: 'var(--text)', opacity: 0.55, cursor: 'pointer', background: speedOpen ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent' }}
                >
                  {speed}×<ChevronDown size={8} style={{ opacity: 0.5, transform: speedOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.15s' }} />
                </button>
                {speedOpen && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 py-0.5 rounded-lg shadow-lg z-50" style={{ background: 'var(--surface)', border: '1px solid var(--border)', minWidth: 44 }}>
                    {[0.5, 0.75, 1, 1.25, 1.5, 2, 3].map(s => (
                      <button key={s} type="button" onClick={() => { setSpd(s); setSpeedOpen(false) }}
                        className="w-full text-left px-2 py-0.5 text-[0.62rem] transition-colors"
                        style={{ color: s === speed ? 'var(--accent)' : 'var(--text)', fontWeight: s === speed ? 700 : 400, background: s === speed ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent' }}
                        onMouseEnter={e => { if (s !== speed) e.currentTarget.style.background = 'color-mix(in srgb, var(--text) 6%, transparent)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = s === speed ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent' }}
                      >{s}×</button>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ flex: 1 }} />

              {/* Volume */}
              <button onClick={toggleMute} style={btn()}>{muted ? <VolumeX size={11} /> : <Volume2 size={11} />}</button>
              <input type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume}
                style={{ width: 44, accentColor: 'var(--accent)', cursor: 'pointer' }}
                onChange={e => setVol(+e.target.value)} />

              {/* Spectrogram toggle */}
              <button onClick={() => setShowSpectrogram(v => !v)}
                style={{ ...btn(), border: showSpectrogram ? '1px solid var(--accent)' : '1px solid var(--border)', color: showSpectrogram ? 'var(--accent)' : 'var(--text)', background: showSpectrogram ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'transparent', borderRadius: 100, padding: '2px 6px', fontSize: '0.58rem', gap: 2, display: 'flex', alignItems: 'center' }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="2" y="2" width="20" height="20" rx="3" /><line x1="6" y1="18" x2="6" y2="12" /><line x1="10" y1="18" x2="10" y2="8" /><line x1="14" y1="18" x2="14" y2="14" /><line x1="18" y1="18" x2="18" y2="6" /></svg>
              </button>

              {/* Add media */}
              <button onClick={() => fileInputRef.current?.click()}
                style={{ ...btn(), border: '1px solid var(--border)', borderRadius: 100, padding: '2px 6px', fontSize: '0.60rem', gap: 2, display: 'flex', alignItems: 'center' }}>
                <Plus size={9} /> Add
              </button>
              <input ref={fileInputRef} type="file" accept="audio/*,video/*" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) onFileLoad(f); e.target.value = '' }} />

              {/* Analyse */}
              {canAnalyse && (
                <button onClick={onAnalyse}
                  style={{ background: 'var(--accent)', color: '#1a1210', border: 'none', borderRadius: 100, padding: '2px 8px', fontSize: '0.62rem', fontWeight: 700, cursor: 'pointer' }}>
                  Analyse
                </button>
              )}
              {needsModel && (
                <span style={{ fontSize: '0.58rem', color: 'var(--accent-copper)' }}>⚠ Models</span>
              )}
            </div>

            {/* Progress bar */}
            {isAnalysing && (
              <div style={{ marginTop: 2 }}>
                <div style={{ width: '100%', height: 2, background: 'var(--border)', borderRadius: 1, overflow: 'hidden' }}>
                  <div style={{ width: `${progress ?? 0}%`, height: '100%', background: 'var(--accent)', transition: 'width 0.3s' }} />
                </div>
                <p style={{ textAlign: 'right', fontSize: '0.55rem', opacity: 0.3, marginTop: 1 }}>{stageLabel}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Resize handle (bottom-right corner) ──────────────────────── */}
      {!minimized && !maximized && (
        <div
          onMouseDown={onResizeStart}
          style={{
            position: 'absolute', bottom: 0, right: 0,
            width: 16, height: 16, cursor: 'nwse-resize',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end',
            padding: 2,
          }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" style={{ opacity: 0.25 }}>
            <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" strokeWidth="1" />
            <line x1="9" y1="5" x2="5" y2="9" stroke="currentColor" strokeWidth="1" />
            <line x1="9" y1="9" x2="9" y2="9" stroke="currentColor" strokeWidth="1" />
          </svg>
        </div>
      )}
    </div>
  )
}

function btn(): React.CSSProperties {
  return {
    background: 'none', border: 'none', color: 'var(--text)',
    cursor: 'pointer', opacity: 0.55, display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 2, borderRadius: 4, transition: 'opacity 0.15s',
  }
}
