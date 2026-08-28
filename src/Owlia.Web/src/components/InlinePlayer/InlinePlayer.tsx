import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Plus, ChevronDown, Video, Activity, AudioLines,
} from 'lucide-react'
import WaveSurfer from 'wavesurfer.js'

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

/** Inline spectrogram — block element, not overlay */
function SpectrogramBar({ mediaRef, visible }: { mediaRef: React.RefObject<HTMLVideoElement | null>; visible: boolean }) {
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const animRef     = useRef<number>(0)
  const ctxRef      = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const connectedRef = useRef<HTMLMediaElement | null>(null)

  useEffect(() => {
    const el = mediaRef.current
    if (!el || connectedRef.current === el) return
    if (!ctxRef.current) ctxRef.current = new AudioContext()
    const ctx = ctxRef.current
    try {
      const source = ctx.createMediaElementSource(el)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      analyser.smoothingTimeConstant = 0
      source.connect(analyser)
      analyser.connect(ctx.destination)
      analyserRef.current = analyser
      connectedRef.current = el
    } catch { /* already connected */ }
  })

  useEffect(() => {
    if (visible && ctxRef.current?.state === 'suspended') ctxRef.current.resume()
  }, [visible])

  useEffect(() => {
    if (!visible) { cancelAnimationFrame(animRef.current); return }
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx2d = canvas.getContext('2d')!
    const W = canvas.clientWidth
    const H = canvas.clientHeight
    canvas.width = W; canvas.height = H
    const analyser = analyserRef.current
    if (!analyser) return
    const bins = analyser.frequencyBinCount
    const data = new Uint8Array(bins)

    const draw = () => {
      animRef.current = requestAnimationFrame(draw)
      analyser.getByteFrequencyData(data)
      const img = ctx2d.getImageData(1, 0, W - 1, H)
      ctx2d.putImageData(img, 0, 0)
      const col = W - 1
      for (let y = 0; y < H; y++) {
        const bin = Math.floor((1 - y / H) * bins)
        const v = data[Math.min(bin, bins - 1)] / 255
        if (v < 0.01) { ctx2d.fillStyle = 'rgba(15,11,9,1)' }
        else {
          const r = Math.floor(15 + v * 240)
          const g = Math.floor(11 + v * 174)
          const b = Math.floor(9 + v * 200)
          ctx2d.fillStyle = `rgb(${r},${g},${b})`
        }
        ctx2d.fillRect(col, y, 1, 1)
      }
    }
    draw()
    return () => cancelAnimationFrame(animRef.current)
  }, [visible])

  if (!visible) return null
  return <canvas ref={canvasRef} className="w-full" style={{ height: 56, display: 'block' }} />
}

export function InlinePlayer({
  mediaUrl, mediaFile, subtitle, onFileLoad, onSeek,
  onAnalyse, canAnalyse, needsModel, isAnalysing, stageLabel, progress,
}: Props) {
  const videoRef     = useRef<HTMLVideoElement>(null)
  const wsRef        = useRef<WaveSurfer | null>(null)
  const wsContainer  = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [playing, setPlaying]       = useState(false)
  const [muted, setMuted]           = useState(false)
  const [volume, setVolume]         = useState(1)
  const [currentSec, setCurrentSec] = useState(0)
  const [durationSec, setDuration]  = useState(0)
  const [speed, setSpeed]           = useState(1)
  const [speedOpen, setSpeedOpen]   = useState(false)
  const speedRef                    = useRef<HTMLDivElement>(null)

  const [showWaveform, setShowWaveform]       = useState(false)
  const [showSpectrogram, setShowSpectrogram] = useState(false)
  const [wsReady, setWsReady]                 = useState(false)
  const [draggingFile, setDraggingFile]       = useState(false)

  // ── WaveSurfer ─────────────────────────────────────────────────────
  useEffect(() => {
    const el = wsContainer.current
    if (!el || wsRef.current) return
    const ws = WaveSurfer.create({
      container: el,
      waveColor: 'rgba(242,163,91,0.22)',
      progressColor: 'rgba(242,163,91,0.85)',
      cursorColor: '#feb903',
      cursorWidth: 2,
      barWidth: 2, barGap: 1, barRadius: 2,
      height: 36, normalize: true, interact: true,
      fillParent: true, minPxPerSec: 60,
    })
    ws.on('interaction', (t: number) => {
      if (videoRef.current) { videoRef.current.currentTime = t; videoRef.current.play(); setPlaying(true) }
    })
    ws.on('ready', () => setWsReady(true))
    wsRef.current = ws
    return () => { ws.destroy(); wsRef.current = null; setWsReady(false) }
  }, [])

  useEffect(() => { if (wsRef.current && mediaUrl) wsRef.current.load(mediaUrl) }, [mediaUrl])

  useEffect(() => {
    const ws = wsRef.current
    if (!ws || !wsReady) return
    ws.seekTo(currentSec / (ws.getDuration() || 1))
  }, [currentSec, wsReady])

  // ── Video callbacks ────────────────────────────────────────────────
  const onTimeUpdate = useCallback(() => {
    const v = videoRef.current; if (!v) return
    setCurrentSec(v.currentTime)
    onSeek(v.currentTime * 1000)
  }, [onSeek])

  const onMeta = () => { if (videoRef.current) setDuration(videoRef.current.duration) }

  const togglePlay = () => {
    const v = videoRef.current; if (!v) return
    v.paused ? (v.play(), setPlaying(true)) : (v.pause(), setPlaying(false))
  }

  const skip = (d: number) => {
    const v = videoRef.current
    if (v) v.currentTime = Math.max(0, Math.min(durationSec, v.currentTime + d))
  }

  const setVol = (val: number) => { setVolume(val); setMuted(val === 0); if (videoRef.current) videoRef.current.volume = val }
  const toggleMute = () => { const v = videoRef.current; if (!v) return; v.muted = !v.muted; setMuted(v.muted) }
  const setSpd = (s: number) => { setSpeed(s); if (videoRef.current) videoRef.current.playbackRate = s }

  useEffect(() => {
    if (!speedOpen) return
    const h = (e: MouseEvent) => { if (speedRef.current && !speedRef.current.contains(e.target as Node)) setSpeedOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [speedOpen])

  const hasViz = showWaveform || showSpectrogram

  return (
    <div
      style={{ background: 'var(--surface)', color: 'var(--text)' }}
      onDragOver={e => { e.preventDefault(); setDraggingFile(true) }}
      onDragLeave={() => setDraggingFile(false)}
      onDrop={e => { e.preventDefault(); setDraggingFile(false); const f = e.dataTransfer.files[0]; if (f) onFileLoad(f) }}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
        <Video size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        <span style={{ fontSize: '0.70rem', fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {mediaFile?.name || 'Media Player'}
        </span>
        {isAnalysing && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', animation: 'pulse-dot 1.6s ease-in-out infinite', flexShrink: 0 }} />}
      </div>

      {/* ── Video ──────────────────────────────────────────────────────── */}
      <div style={{ position: 'relative', height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--player-bg)', overflow: 'hidden' }}>
        {draggingFile && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'color-mix(in srgb, var(--accent) 8%, var(--bg))', border: '2px dashed var(--accent)' }}>
            <p style={{ color: 'var(--accent)', fontWeight: 600, fontSize: '0.85rem' }}>Drop media file</p>
          </div>
        )}
        {mediaUrl ? (
          <video ref={videoRef} src={mediaUrl} style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            onTimeUpdate={onTimeUpdate} onLoadedMetadata={onMeta}
            onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, opacity: 0.2, cursor: 'pointer', padding: 20 }} onClick={() => fileInputRef.current?.click()}>
            <Video size={32} /><p style={{ fontSize: '0.78rem' }}>Drop or click to load</p>
          </div>
        )}
        {subtitle && (
          <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', maxWidth: '80%', background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(4px)', borderRadius: 6, padding: '3px 10px', fontSize: '0.78rem', fontWeight: 500, color: 'var(--text)', textAlign: 'center', pointerEvents: 'none', zIndex: 5 }}>
            {subtitle}
          </div>
        )}
      </div>

      {/* ── Viz row ──────────────────────────────────────────────────────── */}
      {hasViz && (
        <div style={{ background: 'var(--player-bg)', borderTop: '1px solid var(--border)' }}>
          {showWaveform && <div ref={wsContainer} style={{ width: '100%', padding: '4px 8px' }} />}
          {showSpectrogram && <SpectrogramBar mediaRef={videoRef} visible={showSpectrogram} />}
        </div>
      )}

      {/* ── Controls ───────────────────────────────────────────────────── */}
      <div style={{ padding: '4px 8px 6px', borderTop: '1px solid var(--border)' }}>
        <input type="range" min={0} max={durationSec || 100} step={0.1} value={currentSec}
          style={{ width: '100%', accentColor: 'var(--accent)', height: 2, display: 'block', cursor: 'pointer' }}
          onChange={e => { const v = +e.target.value; setCurrentSec(v); if (videoRef.current) videoRef.current.currentTime = v }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
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
            <button type="button" onClick={() => setSpeedOpen(o => !o)}
              className="flex items-center gap-0.5 rounded px-1 py-0.5 text-[0.62rem] transition-colors"
              style={{ color: 'var(--text)', opacity: 0.55, cursor: 'pointer', background: speedOpen ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent' }}>
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

          <button onClick={toggleMute} style={btn()}>{muted ? <VolumeX size={11} /> : <Volume2 size={11} />}</button>
          <input type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume}
            style={{ width: 44, accentColor: 'var(--accent)', cursor: 'pointer' }}
            onChange={e => setVol(+e.target.value)} />

          <button onClick={() => setShowWaveform(v => !v)}
            style={{ ...btn(), border: showWaveform ? '1px solid var(--accent)' : '1px solid var(--border)', color: showWaveform ? 'var(--accent)' : 'var(--text)', background: showWaveform ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'transparent', borderRadius: 100, padding: '2px 6px', display: 'flex', alignItems: 'center' }}>
            <Activity size={10} />
          </button>

          <button onClick={() => setShowSpectrogram(v => !v)}
            style={{ ...btn(), border: showSpectrogram ? '1px solid var(--accent)' : '1px solid var(--border)', color: showSpectrogram ? 'var(--accent)' : 'var(--text)', background: showSpectrogram ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'transparent', borderRadius: 100, padding: '2px 6px', display: 'flex', alignItems: 'center' }}>
            <AudioLines size={10} />
          </button>

          <button onClick={() => fileInputRef.current?.click()}
            style={{ ...btn(), border: '1px solid var(--border)', borderRadius: 100, padding: '2px 6px', fontSize: '0.60rem', gap: 2, display: 'flex', alignItems: 'center' }}>
            <Plus size={9} /> Add
          </button>
          <input ref={fileInputRef} type="file" accept="audio/*,video/*" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) onFileLoad(f); e.target.value = '' }} />

          {canAnalyse && (
            <button onClick={onAnalyse}
              style={{ background: 'var(--accent)', color: '#1a1210', border: 'none', borderRadius: 100, padding: '2px 8px', fontSize: '0.62rem', fontWeight: 700, cursor: 'pointer' }}>
              Analyse
            </button>
          )}
          {needsModel && <span style={{ fontSize: '0.58rem', color: 'var(--accent-copper)' }}>⚠ Models</span>}
        </div>

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
  )
}

function btn(): React.CSSProperties {
  return { background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', opacity: 0.55, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 2, borderRadius: 4, transition: 'opacity 0.15s' }
}
