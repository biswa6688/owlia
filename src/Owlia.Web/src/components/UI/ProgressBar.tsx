interface Props {
  value: number // 0-100
  className?: string
  color?: string
}

export function ProgressBar({ value, className = '', color }: Props) {
  const bg = color ??
    (value < 40 ? '#ef4444' : value < 60 ? '#eab308' : '#22c55e')

  return (
    <div
      className={`h-2 w-full overflow-hidden rounded-full ${className}`}
      style={{ background: 'var(--surface-2)' }}
    >
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: bg }}
      />
    </div>
  )
}
