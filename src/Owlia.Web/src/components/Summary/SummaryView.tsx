import type { SummaryResult } from '../../api/client'
import { Badge } from '../UI/Badge'

interface Props {
  summary: SummaryResult | null
}

export function SummaryView({ summary }: Props) {
  if (!summary) {
    return (
      <div className="flex h-full items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
        Summary will appear after analysis completes.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 overflow-y-auto p-4">

      {/* Summary text */}
      <div
        className="rounded-xl p-5"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Summary
        </h3>
        <p className="text-sm leading-relaxed">
          {summary.summary || 'No summary generated.'}
        </p>
      </div>

      {/* Keywords */}
      {summary.keywords.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Keywords
          </h3>
          <div className="flex flex-wrap gap-2">
            {summary.keywords.map(kw => (
              <Badge key={kw} color="var(--accent)">{kw}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* Key takeaways */}
      {summary.keyTakeaways.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Key Takeaways
          </h3>
          <ol className="flex flex-col gap-3">
            {summary.keyTakeaways.map((takeaway, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed">
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                  style={{ background: 'var(--accent)', color: '#1a1210' }}
                >
                  {i + 1}
                </span>
                <span>{takeaway}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}
