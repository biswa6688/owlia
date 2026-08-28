import { useEffect, useRef } from 'react'

interface Props {
  mediaRef: React.RefObject<HTMLVideoElement | null>
  visible: boolean
}

/**
 * Real-time spectrogram overlay rendered on a canvas.
 * Uses Web Audio API AnalyserNode to get frequency data
 * and draws a scrolling spectrogram (time on X, frequency on Y, colour = magnitude).
 */
export function Spectrogram({ mediaRef, visible }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const animRef   = useRef<number>(0)
  const ctxRef    = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const connectedRef = useRef<HTMLMediaElement | null>(null)
  const colRef    = useRef(0) // current X column position

  // Connect analyser to media element (once)
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

  // Resume AudioContext on play
  useEffect(() => {
    if (visible && ctxRef.current?.state === 'suspended') {
      ctxRef.current.resume()
    }
  }, [visible])

  // Animation loop — draw spectrogram columns
  useEffect(() => {
    if (!visible) {
      cancelAnimationFrame(animRef.current)
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx2d = canvas.getContext('2d')!
    // Match display size
    const W = canvas.clientWidth
    const H = canvas.clientHeight
    canvas.width = W
    canvas.height = H
    colRef.current = 0

    const analyser = analyserRef.current
    if (!analyser) return

    const bins = analyser.frequencyBinCount
    const data = new Uint8Array(bins)

    const draw = () => {
      animRef.current = requestAnimationFrame(draw)
      analyser.getByteFrequencyData(data)

      // Scroll left by 1 pixel
      const img = ctx2d.getImageData(1, 0, W - 1, H)
      ctx2d.putImageData(img, 0, 0)

      // Draw new column at the right edge
      const col = W - 1
      for (let y = 0; y < H; y++) {
        // Map Y (top=high freq, bottom=low freq) to bin
        const bin = Math.floor((1 - y / H) * bins)
        const v = data[Math.min(bin, bins - 1)] / 255
        if (v < 0.01) {
          ctx2d.fillStyle = 'rgba(15,11,9,1)'
        } else {
          // Colour: dark → amber → gold → white
          const r = Math.floor(15 + v * 240)
          const g = Math.floor(11 + v * 174)
          const b = Math.floor(9  + v * 200)
          ctx2d.fillStyle = `rgb(${r},${g},${b})`
        }
        ctx2d.fillRect(col, y, 1, 1)
      }
    }

    draw()
    return () => cancelAnimationFrame(animRef.current)
  }, [visible])

  if (!visible) return null

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{
        zIndex: 10,
        borderRadius: 10,
        opacity: 0.88,
        mixBlendMode: 'screen',
      }}
    />
  )
}
