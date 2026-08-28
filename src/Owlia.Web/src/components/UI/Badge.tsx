interface Props {
  children: React.ReactNode
  color?: string
  className?: string
}

export function Badge({ children, color, className = '' }: Props) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}
      style={{
        background: color ? `${color}22` : 'var(--surface-2)',
        color: color ?? 'var(--text-muted)',
        border: `1px solid ${color ? `${color}44` : 'var(--border)'}`,
      }}
    >
      {children}
    </span>
  )
}
