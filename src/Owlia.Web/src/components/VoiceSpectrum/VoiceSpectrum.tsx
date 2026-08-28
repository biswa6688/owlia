import { useEffect, useRef } from 'react'

interface Props {
  /** Pass the ref object itself — the component will read .current internally */
  mediaRef: React.RefObject<HTMLVideoElement | HTMLAudioElement | null>
  isPlaying: boolean
  height?: number
  barColor?: string
  barCount?: number
}

/**
 * Canvas WebAudio API spectrum visualizer.
 * Connects lazily once the media element is available, handles AudioContext resume.
 */
export function VoiceSpectrum({
  mediaRef,
  isPlaying,
  height = 52,
  barColor = '#f2a35b',
  barCount = 80,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const connectedRef = useRef<HTMLMediaElement | null>(null)

  // Connect analyser when media element becomes available
  useEffect(() => {
    const el = mediaRef.current
    if (!el || connectedRef.current === el) return

    // Create AudioContext lazily
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext()
    }
    const ctx = audioCtxRef.current

    try {
      const source = ctx.createMediaElementSource(el)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = Math.pow(2, Math.ceil(Math.log2(barCount * 4)))
      analyser.smoothingTimeConstant = 0.82
      source.connect(analyser)
      analyser.connect(ctx.destination)
      analyserRef.current = analyser
      connectedRef.current = el
    } catch {
      // Already wrapped — ignore (happens in React StrictMode double-invoke)
    }
  })

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx2d = canvas.getContext('2d')!

    const draw = () => {
      animRef.current = requestAnimationFrame(draw)
      const { width, height: h } = canvas
      ctx2d.clearRect(0, 0, width, h)

      const analyser = analyserRef.current
      if (!analyser || !isPlaying) {
        // Idle: flat centre line
        ctx2d.fillStyle = barColor + '44'
        const bw = width / barCount
        for (let i = 0; i < barCount; i++) {
          ctx2d.fillRect(i * bw + 1, h / 2 - 1, Math.max(1, bw - 2), 2)
        }
        return
      }

      const data = new Uint8Array(analyser.frequencyBinCount)
      analyser.getByteFrequencyData(data)
      const bw = width / barCount

      for (let i = 0; i < barCount; i++) {
        const bin = Math.floor((i / barCount) * analyser.frequencyBinCount)
        const v = data[bin] / 255
        const barH = Math.max(2, v * h * 0.92)
        const y = (h - barH) / 2
        const opacity = Math.round((0.3 + v * 0.7) * 255).toString(16).padStart(2, '0')
        ctx2d.fillStyle = barColor + opacity

        const x = i * bw + 1
        const bwInner = Math.max(1, bw - 2)
        ctx2d.beginPath()
        ctx2d.roundRect(x, y, bwInner, barH, 2)
        ctx2d.fill()
      }
    }

    draw()
    return () => cancelAnimationFrame(animRef.current)
  }, [isPlaying, barColor, barCount])

  // Resume AudioContext on play (browsers suspend it until user gesture)
  useEffect(() => {
    if (isPlaying && audioCtxRef.current?.state === 'suspended') {
      audioCtxRef.current.resume()
    }
  }, [isPlaying])

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={height}
      className="w-full"
      style={{ display: 'block' }}
    />
  )
}
