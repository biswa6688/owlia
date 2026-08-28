import type { CSSProperties, SVGProps } from 'react'

type Ic = SVGProps<SVGSVGElement> & { size?: number | string }

function ic(d: string, vb = '0 0 24 24') {
  return ({ size = 24, style, ...rest }: Ic) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={vb} width={size} height={size}
      fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, ...style } as CSSProperties} {...rest}>
      <path d={d} />
    </svg>
  )
}

function icMulti(paths: string[], vb = '0 0 24 24') {
  return ({ size = 24, style, ...rest }: Ic) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={vb} width={size} height={size}
      fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, ...style } as CSSProperties} {...rest}>
      {paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  )
}

// ── Player ────────────────────────────────────────────────────────────────────

export const Play = ic('M5 3l14 9-14 9V3z')

export const Pause = icMulti([
  'M6 4h4v16H6z',
  'M14 4h4v16h-4z',
])

export const SkipBack = icMulti([
  'M19 20L9 12l10-8v16z',
  'M5 19V5',
])

export const SkipForward = icMulti([
  'M5 4l10 8-10 8V4z',
  'M19 5v14',
])

export const Volume2 = icMulti([
  'M11 5L6 9H2v6h4l5 4V5z',
  'M15.54 8.46a5 5 0 010 7.07',
  'M19.07 4.93a10 10 0 010 14.14',
])

export const VolumeX = icMulti([
  'M11 5L6 9H2v6h4l5 4V5z',
  'M23 9l-6 6',
  'M17 9l6 6',
])

export const Plus = icMulti([
  'M12 5v14',
  'M5 12h14',
])

export const ChevronDown = ic('M6 9l6 6 6-6')

export const Video = icMulti([
  'M23 7l-7 5 7 5V7z',
  'M14 5H3a2 2 0 00-2 2v10a2 2 0 002 2h11a2 2 0 002-2V7a2 2 0 00-2-2z',
])

export const Activity = ic('M22 12h-4l-3 9L9 3l-3 9H2')

export const AudioLines = icMulti([
  'M2 12h2',
  'M6 8v8',
  'M10 5v14',
  'M14 8v8',
  'M18 6v12',
  'M22 10v4',
])

export const Minimize2 = icMulti([
  'M8 3v3a2 2 0 01-2 2H3',
  'M21 8h-3a2 2 0 01-2-2V3',
  'M3 16h3a2 2 0 012 2v3',
  'M16 21v-3a2 2 0 012-2h3',
])

export const Maximize2 = icMulti([
  'M15 3h6v6',
  'M9 21H3v-6',
  'M21 3l-7 7',
  'M3 21l7-7',
])

export const Square = ic('M3 3h18v18H3V3z')

export const GripHorizontal = icMulti([
  'M9 4v2',
  'M15 4v2',
  'M9 10v2',
  'M15 10v2',
  'M9 16v2',
  'M15 16v2',
])

// ── Nav / General ─────────────────────────────────────────────────────────────

export const ArrowRight = icMulti([
  'M5 12h14',
  'M12 5l7 7-7 7',
])

export const Check = ic('M20 6L9 17l-5-5')

export const Mic = icMulti([
  'M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z',
  'M19 10v2a7 7 0 01-14 0v-2',
  'M12 19v4',
  'M8 23h8',
])

export const Users = icMulti([
  'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2',
  'M9 3a4 4 0 100 8 4 4 0 000-8z',
  'M23 21v-2a4 4 0 00-3-3.87',
  'M16 3.13a4 4 0 010 7.75',
])

export const BarChart2 = icMulti([
  'M18 20V10',
  'M12 20V4',
  'M6 20v-6',
])

export const FileText = icMulti([
  'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z',
  'M14 2v6h6',
  'M16 13H8',
  'M16 17H8',
  'M10 9H8',
])

export const Terminal = icMulti([
  'M4 17l6-5-6-5',
  'M12 19h8',
])

export const Zap = ic('M13 2L3 14h9l-1 8 10-12h-9l1-8z')

export const Shield = ic('M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z')

export const Cpu = icMulti([
  'M9 3v2',
  'M15 3v2',
  'M9 19v2',
  'M15 19v2',
  'M3 9h2',
  'M3 15h2',
  'M19 9h2',
  'M19 15h2',
  'M6 6h12v12H6z',
])

export const Moon = ic('M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z')

export const Sun = icMulti([
  'M12 7a5 5 0 100 10 5 5 0 000-10z',
  'M12 1v2',
  'M12 21v2',
  'M4.22 4.22l1.42 1.42',
  'M18.36 18.36l1.42 1.42',
  'M1 12h2',
  'M21 12h2',
  'M4.22 19.78l1.42-1.42',
  'M18.36 5.64l1.42-1.42',
])

export const Monitor = icMulti([
  'M2 3h20v14H2z',
  'M8 21h8',
  'M12 17v4',
])

// ── Download / History ────────────────────────────────────────────────────────

export const DownloadIcon = icMulti([
  'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4',
  'M7 10l5 5 5-5',
  'M12 15V3',
])

export const CheckCircle = icMulti([
  'M22 11.08V12a10 10 0 11-5.93-9.14',
  'M22 4L12 14.01l-3-3',
])

export const Circle = ic('M12 22a10 10 0 100-20 10 10 0 000 20z')

export const Loader2 = ic('M21 12a9 9 0 11-6.219-8.56')

export const Trash2 = icMulti([
  'M3 6h18',
  'M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2',
  'M10 11v6',
  'M14 11v6',
])

export const Clock = icMulti([
  'M12 22a10 10 0 100-20 10 10 0 000 20z',
  'M12 6v6l4 2',
])

export const Calendar = icMulti([
  'M19 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2z',
  'M16 2v4',
  'M8 2v4',
  'M3 10h18',
])

// ── CLI ───────────────────────────────────────────────────────────────────────

export const Send = icMulti([
  'M22 2L11 13',
  'M22 2l-7 20-4-9-9-4 20-7z',
])

export const AlertCircle = icMulti([
  'M12 22a10 10 0 100-20 10 10 0 000 20z',
  'M12 8v4',
  'M12 16h.01',
])

export const AlertTriangle = icMulti([
  'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z',
  'M12 9v4',
  'M12 17h.01',
])

export const Sparkles = icMulti([
  'M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z',
  'M19 14l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z',
  'M5 17l0.5 1.5L7 19l-1.5 0.5L5 21l-0.5-1.5L3 19l1.5-0.5L5 17z',
])

export const Lock = icMulti([
  'M7 11V7a5 5 0 0110 0v4',
  'M5 11h14a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2v-7a2 2 0 012-2z',
])

export const Copy = icMulti([
  'M20 9h-8a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-8a2 2 0 00-2-2z',
  'M4 15H3a1 1 0 01-1-1V3a1 1 0 011-1h11a1 1 0 011 1v1',
])

export const X = icMulti([
  'M18 6L6 18',
  'M6 6l12 12',
])

export const RefreshCw = icMulti([
  'M23 4v6h-6',
  'M1 20v-6h6',
  'M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15',
])
