import { useEffect, useRef } from 'react'
import type { SpeakerSegment } from '../../api/client'
import { speakerColor } from '../../store/playgroundStore'
import { Badge } from '../UI/Badge'

interface Props {
  segments: SpeakerSegment[]
  activeIndex: number
  onSeek: (ms: number) => void
}

function formatTime(ms: number) {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function sentimentEmoji(label: string) {
  if (label === 'Positive') return '😊'
  if (label === 'Negative') return '😟'
  return '😐'
}

export function TranscriptList({ segments, activeIndex, onSeek }: Props) {
  const activeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [activeIndex])

  if (segments.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
        No transcript yet. Load a media file and click Analyse.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 overflow-y-auto p-4">
      {segments.map((seg, i) => {
        const isActive = i === activeIndex
        const color = speakerColor(seg.speaker)

        return (
          <div
            key={seg.id}
            ref={isActive ? activeRef : undefined}
            onClick={() => onSeek(seg.startMs)}
            className="cursor-pointer rounded-xl p-3 transition-all hover:brightness-110"
            style={{
              background: isActive ? `${color}18` : 'var(--surface)',
              border: `1px solid ${isActive ? color : 'var(--border)'}`,
              boxShadow: isActive ? `0 0 0 1px ${color}44` : 'none',
            }}
          >
            <div className="mb-1 flex items-center gap-2">
              <Badge color={color}>{seg.speaker}</Badge>
              <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                {formatTime(seg.startMs)} – {formatTime(seg.endMs)}
              </span>
              <span className="ml-auto text-sm" title={seg.sentimentLabel}>
                {sentimentEmoji(seg.sentimentLabel)}
              </span>
            </div>
            <p className="text-sm leading-relaxed">{seg.text}</p>
          </div>
        )
      })}
    </div>
  )
}
