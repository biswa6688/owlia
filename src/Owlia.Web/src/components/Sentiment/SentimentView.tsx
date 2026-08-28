import type { SentimentResult } from '../../api/client'
import { speakerColor } from '../../store/playgroundStore'
import { ProgressBar } from '../UI/ProgressBar'

interface Props {
  sentiment: SentimentResult | null
  totalDurationMs: number
}

export function SentimentView({ sentiment, totalDurationMs }: Props) {
  if (!sentiment) {
    return (
      <div className="flex h-full items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
        Sentiment data will appear after analysis.
      </div>
    )
  }

  const duration = totalDurationMs || 1

  return (
    <div className="flex flex-col gap-6 overflow-y-auto p-4">

      {/* Speaker cards */}
      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          By Speaker
        </h3>
        {sentiment.bySpeaker.map(sp => {
          const color = speakerColor(sp.speaker)
          return (
            <div
              key={sp.speaker}
              className="rounded-xl p-4"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ background: color }} />
                  <span className="font-medium">{sp.speaker}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{sp.overallLabel}</span>
                  <span className="text-sm font-bold" style={{ color: 'var(--accent)' }}>
                    {sp.overallScore.toFixed(0)}
                  </span>
                </div>
              </div>
              <ProgressBar value={sp.overallScore} />
              <div className="mt-1 flex justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
                <span>Negative</span>
                <span>Neutral</span>
                <span>Positive</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Sentence timeline */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Timeline
        </h3>
        <div
          className="relative h-8 w-full overflow-hidden rounded-full"
          style={{ background: 'var(--surface-2)' }}
          title="Sentiment timeline — colored by speaker, shade by sentiment score"
        >
          {sentiment.timeline.map(seg => {
            const left = (seg.startMs / duration) * 100
            const width = Math.max(0.3, ((seg.endMs - seg.startMs) / duration) * 100)
            const color = speakerColor(seg.speaker)
            const opacity = 0.4 + (seg.sentimentScore / 100) * 0.6
            return (
              <div
                key={seg.id}
                className="absolute h-full"
                style={{ left: `${left}%`, width: `${width}%`, background: color, opacity }}
                title={`${seg.speaker}: ${seg.sentimentLabel} (${seg.sentimentScore.toFixed(0)})`}
              />
            )
          })}
        </div>
        <div className="mt-1 flex justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
          <span>Start</span>
          <span>End</span>
        </div>
      </div>
    </div>
  )
}
