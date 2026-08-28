import { Link } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { useModelStore, MODEL_REQUIREMENTS } from '../../store/modelStore'

interface Props {
  feature: string   // key into MODEL_REQUIREMENTS
  children: React.ReactNode
}

/**
 * Wraps a UI section. When required models are missing it shows a banner
 * instead of the children.
 */
export function ModelGate({ feature, children }: Props) {
  const { models, isReady } = useModelStore()

  // Always allow through if models list isn't ready yet or not an array
  if (!Array.isArray(models) || models.length === 0) return <>{children}</>

  if (isReady(feature)) return <>{children}</>

  const missing = (MODEL_REQUIREMENTS[feature] ?? [])
    .filter(id => !models.find(m => m.id === id)?.downloaded)

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <AlertTriangle size={32} style={{ color: 'var(--accent)' }} />
      <p className="font-semibold">Models required</p>
      <p className="max-w-xs text-sm" style={{ color: 'var(--text-muted)' }}>
        The following ONNX models need to be downloaded before this feature is available:
      </p>
      <ul className="text-sm font-mono" style={{ color: 'var(--accent)' }}>
        {missing.map(id => <li key={id}>{id}</li>)}
      </ul>
      <Link
        to="/download"
        className="mt-2 rounded-full px-5 py-2 text-sm font-semibold transition-all hover:brightness-110"
        style={{ background: 'var(--accent)', color: '#1a1210' }}
      >
        Go to Download
      </Link>
    </div>
  )
}
