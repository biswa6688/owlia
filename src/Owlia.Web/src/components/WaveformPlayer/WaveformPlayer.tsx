import { useEffect, useRef, useState } from 'react'
import WaveSurfer from 'wavesurfer.js'

interface Props {
  mediaRef: React.RefObject<HTMLVideoElement | null>
  currentSec: number
  onSeek: (sec: number) => void
}

/**
 * WaveSurfer.js waveform visualization.
 * Syncs with the <video> element's playback position.
 * Renders a polished waveform with progress colour and hover cursor.
 */
export function WaveformPlayer({ mediaRef, currentSec, onSeek }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const wsRef       = useRef<WaveSurfer | null>(null)
  const [ready, setReady] = useState(false)

  // Create WaveSurfer instance
  useEffect(() => {
    const el = containerRef.current
    if (!el || wsRef.current) return

    const ws = WaveSurfer.create({
      container: el,
      waveColor: 'rgba(242,163,91,0.25)',
      progressColor: 'rgba(242,163,91,0.85)',
      cursorColor: '#feb903',
      cursorWidth: 2,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 'auto',
      normalize: true,
      interact: true,
      fillParent: true,
      minPxPerSec: 50,
    })

    ws.on('interaction', (newTime: number) => {
      onSeek(newTime)
      if (mediaRef.current) {
        mediaRef.current.currentTime = newTime
        mediaRef.current.play()
      }
    })

    ws.on('ready', () => setReady(true))
    wsRef.current = ws

    return () => { ws.destroy(); wsRef.current = null; setReady(false) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load media URL when available
  useEffect(() => {
    const ws = wsRef.current
    const v = mediaRef.current
    if (!ws || !v?.src) return
    // WaveSurfer can load from the same src as the video
    ws.load(v.src)
  }, [mediaRef.current?.src])

  // Sync playback position
  useEffect(() => {
    const ws = wsRef.current
    if (!ws || !ready) return
    ws.seekTo(currentSec / (ws.getDuration() || 1))
  }, [currentSec, ready])

  return (
    <div
      ref={containerRef}
      className="w-full"
      style={{ height: 48, opacity: ready ? 1 : 0.3, transition: 'opacity 0.3s' }}
    />
  )
}
