import type { SummaryResult } from '../../api/client'
import { Badge } from '../UI/Badge'
import { FileText } from '../Icons/icons'

interface Props {
  summary: SummaryResult | null
  onGenerate?: () => void
  isAnalysing?: boolean
}

export function SummaryView({ summary, onGenerate, isAnalysing }: Props) {
  if (!summary) {
    return (
      <div className="flex h-full items-center justify-center">
        <button
          onClick={onGenerate}
          disabled={!onGenerate || isAnalysing}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', borderRadius: 10,
            background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
            border: '1px solid var(--accent)',
            color: 'var(--accent)', fontWeight: 600, fontSize: '0.82rem',
            cursor: !onGenerate || isAnalysing ? 'default' : 'pointer',
            opacity: !onGenerate || isAnalysing ? 0.4 : 1,
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => {
            if (onGenerate && !isAnalysing) {
              e.currentTarget.style.background = 'color-mix(in srgb, var(--accent) 18%, transparent)'
              e.currentTarget.style.transform = 'translateY(-1px)'
            }
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'color-mix(in srgb, var(--accent) 10%, transparent)'
            e.currentTarget.style.transform = 'translateY(0)'
          }}
        >
          <FileText size={16} />
          {isAnalysing ? 'Generating…' : 'Generate Summary'}
        </button>
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
