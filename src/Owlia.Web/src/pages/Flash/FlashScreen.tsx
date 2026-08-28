import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'

const FLASH_MS = 5000
const BRAND = 'OWLIA'
const TAGLINE = 'Offline Voice & Language Intelligence Analytics'

export function FlashScreen() {
  const navigate = useNavigate()

  useEffect(() => {
    const t = setTimeout(() => navigate('/landing', { replace: true }), FLASH_MS)
    return () => clearTimeout(t)
  }, [navigate])

  return (
    <div
      className="bg-stripe relative flex h-screen w-screen flex-col items-center justify-center overflow-hidden"
      style={{ background: '#1a1210' }}
    >
      {/* ── Deep vignette — keeps centre dark and dramatic ── */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 70% at 50% 50%, transparent 20%, #1a1210 80%)',
        }}
      />

      {/* ── Warm amber bloom behind the icon ── */}
      <motion.div
        className="pointer-events-none absolute"
        style={{
          width: 320, height: 320,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(254,185,3,0.18) 0%, rgba(242,163,91,0.10) 40%, transparent 70%)',
          filter: 'blur(32px)',
        }}
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: [1, 1.12, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
      />

      {/* ── Icon container: subtle circle background + ring ── */}
      <motion.div
        className="relative flex items-center justify-center"
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.7, ease: [0.34, 1.56, 0.64, 1] }}
      >
        {/* Outer glow ring — pulsing */}
        <motion.div
          className="absolute rounded-full"
          style={{
            width: 160, height: 160,
            background: 'transparent',
            border: '1.5px solid rgba(254,185,3,0.35)',
          }}
          animate={{ scale: [1, 1.18, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
        />

        {/* Icon background disc — warm surface so the coloured SVG reads clearly */}
        <div
          className="relative flex items-center justify-center rounded-full"
          style={{
            width: 120, height: 120,
            background:
              'radial-gradient(circle at 40% 35%, #3a2a1e 0%, #241810 100%)',
            border: '1.5px solid rgba(242,163,91,0.25)',
            boxShadow:
              '0 0 0 8px rgba(242,163,91,0.06), 0 0 32px rgba(254,185,3,0.12)',
          }}
        >
          <img
            src="/owlia.svg"
            alt="OWLIA owl"
            style={{ width: 72, height: 72, filter: 'drop-shadow(0 2px 8px rgba(254,185,3,0.30))' }}
          />
        </div>
      </motion.div>

      {/* ── Brand name — letter by letter reveal ── */}
      <div className="mt-9 flex items-baseline gap-[2px]">
        {BRAND.split('').map((ch, i) => (
          <motion.span
            key={i}
            style={{
              color: '#f5dbb8',
              fontWeight: 700,
              fontSize: '2.5rem',
              letterSpacing: '0.25em',
              lineHeight: 1,
            }}
            initial={{ opacity: 0, y: 16, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.45, delay: 0.75 + i * 0.11, ease: 'easeOut' }}
          >
            {ch}
          </motion.span>
        ))}
      </div>

      {/* ── Amber accent line under brand ── */}
      <motion.div
        style={{ height: 2, background: 'linear-gradient(90deg, transparent, #f2a35b, transparent)', borderRadius: 1 }}
        initial={{ width: 0, opacity: 0 }}
        animate={{ width: 140, opacity: 1 }}
        transition={{ duration: 0.6, delay: 1.6, ease: 'easeOut' }}
      />

      {/* ── Tagline ── */}
      <motion.p
        style={{ color: '#d0805f', fontSize: '0.72rem', letterSpacing: '0.06em', marginTop: '0.75rem' }}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 1.95, ease: 'easeOut' }}
      >
        {TAGLINE}
      </motion.p>

      {/* ── Bottom progress bar ── */}
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{ height: 2, background: 'rgba(242,163,91,0.12)' }}
      >
        <motion.div
          style={{ height: '100%', background: 'linear-gradient(90deg, #f2a35b, #feb903)', originX: 0 }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: FLASH_MS / 1000, ease: 'linear' }}
        />
      </div>
    </div>
  )
}
