import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'

const FLASH_MS = 5000
const BRAND    = 'OWLIA'
const TAGLINE  = 'Offline Voice & Language Intelligence Analytics'

// Dark grid colours (hardcoded — Flash is always dark)
const BG        = '#0f0b09'
const GRID_LINE = 'rgba(242,163,91,0.07)'   // amber tint on dark grid
const AMBER     = '#f2a35b'
const GOLD      = '#feb903'
const TEXT      = '#f0d8bc'
const MUTED     = '#b07040'

export function FlashScreen() {
  const navigate = useNavigate()

  useEffect(() => {
    const t = setTimeout(() => navigate('/landing', { replace: true }), FLASH_MS)
    return () => clearTimeout(t)
  }, [navigate])

  return (
    <div
      style={{
        position: 'relative',
        width: '100vw', height: '100vh',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
        // Square grid background — 28 px cells, dark amber lines
        backgroundColor: BG,
        backgroundImage: `
          linear-gradient(${GRID_LINE} 1px, transparent 1px),
          linear-gradient(90deg, ${GRID_LINE} 1px, transparent 1px)
        `,
        backgroundSize: '28px 28px',
      }}
    >

      {/* ── Radial vignette — fades grid to solid dark at edges ── */}
      <div
        style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background:
            'radial-gradient(ellipse 65% 65% at 50% 50%, transparent 10%, rgba(15,11,9,0.92) 78%)',
        }}
      />

      {/* ── Faint wide glow behind the whole centrepiece (not the icon) ── */}
      <motion.div
        style={{
          position: 'absolute', pointerEvents: 'none',
          width: 440, height: 440, borderRadius: '50%',
          background: `radial-gradient(circle, rgba(254,185,3,0.09) 0%, transparent 65%)`,
        }}
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* ── Icon assembly ── */}
      <motion.div
        style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.65, ease: [0.34, 1.56, 0.64, 1] }}
      >

        {/* Outer ring — thin dashed amber circle, slow rotation */}
        <motion.div
          style={{
            position: 'absolute',
            width: 168, height: 168, borderRadius: '50%',
            border: '1px dashed rgba(242,163,91,0.30)',
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}
        />

        {/* Middle ring — solid, pulsing opacity */}
        <motion.div
          style={{
            position: 'absolute',
            width: 136, height: 136, borderRadius: '50%',
            border: `1px solid rgba(242,163,91,0.18)`,
          }}
          animate={{ opacity: [0.4, 1, 0.4], scale: [1, 1.04, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
        />

        {/* Icon disc — flat dark square with rounded corners, amber border */}
        <div
          style={{
            position: 'relative',
            width: 108, height: 108,
            borderRadius: 22,                           // rounded square — not circle
            background: '#1c1208',                      // very dark warm brown
            border: `1.5px solid rgba(242,163,91,0.28)`,
            boxShadow: `
              0 0 0 6px rgba(242,163,91,0.05),
              inset 0 1px 0 rgba(255,255,255,0.04)
            `,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {/* Inner grid pattern inside the disc — same grid as background but slightly brighter */}
          <div
            style={{
              position: 'absolute', inset: 0, borderRadius: 20, overflow: 'hidden',
              backgroundImage: `
                linear-gradient(rgba(242,163,91,0.10) 1px, transparent 1px),
                linear-gradient(90deg, rgba(242,163,91,0.10) 1px, transparent 1px)
              `,
              backgroundSize: '18px 18px',
            }}
          />
          {/* Owl SVG */}
          <img
            src="/owlia.svg"
            alt="OWLIA"
            style={{
              position: 'relative',
              width: 64, height: 64,
              // No drop-shadow — let the icon sit clean on the grid disc
            }}
          />
        </div>

        {/* Four corner tick-marks at 0°/90°/180°/270° — geometric accent */}
        {[0, 90, 180, 270].map(deg => (
          <div
            key={deg}
            style={{
              position: 'absolute',
              width: 10, height: 10,
              top: '50%', left: '50%',
              transform: `rotate(${deg}deg) translateY(-86px) translateX(-50%)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <div style={{ width: 6, height: 1.5, background: AMBER, borderRadius: 1, opacity: 0.7 }} />
          </div>
        ))}

      </motion.div>

      {/* ── Brand name — letter by letter ── */}
      <div style={{ marginTop: 36, display: 'flex', alignItems: 'baseline', gap: 1 }}>
        {BRAND.split('').map((ch, i) => (
          <motion.span
            key={i}
            style={{
              color: TEXT,
              fontWeight: 700,
              fontSize: '2.25rem',
              letterSpacing: '0.28em',
              lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
            }}
            initial={{ opacity: 0, y: 14, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.4, delay: 0.6 + i * 0.10, ease: 'easeOut' }}
          >
            {ch}
          </motion.span>
        ))}
      </div>

      {/* ── Amber rule under brand ── */}
      <motion.div
        style={{
          height: 1,
          background: `linear-gradient(90deg, transparent, ${AMBER}, transparent)`,
          borderRadius: 1,
          marginTop: 10,
        }}
        initial={{ width: 0, opacity: 0 }}
        animate={{ width: 120, opacity: 1 }}
        transition={{ duration: 0.5, delay: 1.5, ease: 'easeOut' }}
      />

      {/* ── Tagline ── */}
      <motion.p
        style={{
          color: MUTED,
          fontSize: '0.70rem',
          letterSpacing: '0.08em',
          marginTop: 10,
          textTransform: 'uppercase',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 1.9 }}
      >
        {TAGLINE}
      </motion.p>

      {/* ── Progress bar at bottom ── */}
      <div
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: 2, background: 'rgba(242,163,91,0.10)',
        }}
      >
        <motion.div
          style={{
            height: '100%',
            background: `linear-gradient(90deg, ${AMBER}, ${GOLD})`,
            transformOrigin: 'left center',
          }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: FLASH_MS / 1000, ease: 'linear' }}
        />
      </div>

    </div>
  )
}
