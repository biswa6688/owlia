import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'

const FLASH_DURATION_MS = 5000
const BRAND = 'OWLIA'

export function FlashScreen() {
  const navigate = useNavigate()

  useEffect(() => {
    const timer = setTimeout(() => navigate('/landing', { replace: true }), FLASH_DURATION_MS)
    return () => clearTimeout(timer)
  }, [navigate])

  return (
    <div
      className="relative flex h-screen w-screen flex-col items-center justify-center overflow-hidden"
      style={{ background: 'var(--bg)' }}
    >
      {/* Radial glow background */}
      <motion.div
        className="pointer-events-none absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2 }}
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(242,163,91,0.18) 0%, transparent 70%)',
        }}
      />

      {/* Owl logo — scale in + glow pulse */}
      <motion.div
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.34, 1.56, 0.64, 1] }}
        className="relative"
      >
        <motion.div
          className="absolute inset-0 rounded-full"
          animate={{
            boxShadow: [
              '0 0 0px 0px rgba(254,185,3,0)',
              '0 0 40px 20px rgba(254,185,3,0.35)',
              '0 0 20px 10px rgba(254,185,3,0.15)',
              '0 0 40px 20px rgba(254,185,3,0.35)',
            ],
          }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
        />
        <img src="/owlia.svg" alt="OWLIA" className="relative h-28 w-28 drop-shadow-lg" />
      </motion.div>

      {/* Brand name — letter by letter */}
      <div className="mt-8 flex gap-[0.05em]">
        {BRAND.split('').map((letter, i) => (
          <motion.span
            key={i}
            className="text-4xl font-bold tracking-widest"
            style={{ color: 'var(--text)' }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.9 + i * 0.12, ease: 'easeOut' }}
          >
            {letter}
          </motion.span>
        ))}
      </div>

      {/* Tagline — fade in */}
      <motion.p
        className="mt-3 text-sm tracking-wide"
        style={{ color: 'var(--text-muted)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 1.8 }}
      >
        Offline Voice &amp; Language Intelligence Analytics
      </motion.p>

      {/* Progress bar at bottom */}
      <motion.div
        className="absolute bottom-0 left-0 h-[2px]"
        style={{ background: 'var(--accent)' }}
        initial={{ width: '0%' }}
        animate={{ width: '100%' }}
        transition={{ duration: FLASH_DURATION_MS / 1000, ease: 'linear' }}
      />
    </div>
  )
}
