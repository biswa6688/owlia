import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DownloadIcon, CheckCircle, Circle, Loader2, Terminal } from '../../components/Icons/icons'
import { motion } from 'framer-motion'
import { ThemeToggle } from '../../components/UI/ThemeToggle'
import { modelsApi, cliApi, type ModelStatus, type CliStatus } from '../../api/client'
import { startHub } from '../../api/signalr'
import { ProgressBar } from '../../components/UI/ProgressBar'

function formatSize(bytes: number) {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(0)} MB`
  return `${(bytes / 1e3).toFixed(0)} KB`
}

interface DownloadProgress {
  modelId: string
  percent: number
  complete?: boolean
}

export function Download() {
  const [models, setModels] = useState<ModelStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState<Record<string, DownloadProgress>>({})
  const [downloading, setDownloading] = useState<Set<string>>(new Set())
  const [cliStatus, setCliStatus] = useState<CliStatus | null>(null)

  useEffect(() => {
    // Helper: ensure we never store a non-array into models state
    const safeSetModels = (raw: unknown) => {
      setModels(Array.isArray(raw) ? raw as ModelStatus[] : [])
    }

    Promise.all([
      modelsApi.getAll().then(safeSetModels).catch(() => safeSetModels([])),
      cliApi.status().then(setCliStatus).catch(() => {}),
    ]).finally(() => setLoading(false))

    // Connect SignalR for download progress — errors are non-fatal
    let active = true
    startHub().then(hub => {
      if (!active) return
      hub.off('ModelDownloadProgress')
      hub.off('ModelDownloadError')

      hub.on('ModelDownloadProgress', (data: DownloadProgress) => {
        setProgress(prev => ({ ...prev, [data.modelId]: data }))
        if (data.complete) {
          setDownloading(prev => { const n = new Set(prev); n.delete(data.modelId); return n })
          modelsApi.getAll().then(safeSetModels).catch(() => {})
        }
      })
      hub.on('ModelDownloadError', (data: { modelId: string; error: string }) => {
        setDownloading(prev => { const n = new Set(prev); n.delete(data.modelId); return n })
        alert(`Download failed for ${data.modelId}: ${data.error}`)
      })
    }).catch(() => {}) // SignalR connection failure is non-fatal

    return () => { active = false }
  }, [])

  const startDownload = async (modelId: string) => {
    setDownloading(prev => new Set(prev).add(modelId))
    setProgress(prev => ({ ...prev, [modelId]: { modelId, percent: 0 } }))
    await modelsApi.download(modelId)
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>

      {/* Nav */}
      <header
        className="flex items-center justify-between px-8 py-4"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <Link to="/landing" className="flex items-center gap-2">
          <img src="/owlia.svg" alt="OWLIA" className="h-7 w-7" />
          <span className="font-bold">OWLIA</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link to="/playground" className="text-sm hover:text-[var(--accent)] transition-colors">Playground</Link>
          <Link to="/history" className="text-sm hover:text-[var(--accent)] transition-colors">History</Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-8 py-10">

        {/* ── ONNX Models ── */}
        <h1 className="mb-1 text-2xl font-bold">ONNX Models</h1>
        <p className="mb-8 text-sm" style={{ color: 'var(--text-muted)' }}>
          Download the models you need. Total ~5.7 GB. Each model unlocks a specific feature.
        </p>

        {loading ? (
          <div className="flex items-center gap-2 py-10 text-sm" style={{ color: 'var(--text-muted)' }}>
            <Loader2 size={16} className="animate-spin" /> Loading model status…
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {(Array.isArray(models) ? models : []).map((model, i) => {
              const isDownloading = downloading.has(model.id)
              const prog = progress[model.id]

              return (
                <motion.div
                  key={model.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="rounded-2xl p-5"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      {model.downloaded ? (
                        <CheckCircle size={20} className="mt-0.5 shrink-0 text-green-500" />
                      ) : (
                        <Circle size={20} className="mt-0.5 shrink-0" style={{ color: 'var(--text-muted)' }} />
                      )}
                      <div>
                        <p className="font-semibold">{model.feature}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          {model.fileName} · {formatSize(model.sizeBytes)}
                        </p>
                      </div>
                    </div>

                    {!model.downloaded && !isDownloading && (
                      <button
                        type="button"
                        onClick={() => startDownload(model.id)}
                        className="flex shrink-0 items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-all hover:brightness-110"
                        style={{ background: 'var(--accent)', color: '#1a1210' }}
                      >
                        <DownloadIcon size={12} /> Download
                      </button>
                    )}

                    {model.downloaded && (
                      <span className="shrink-0 text-xs font-medium text-green-500">Downloaded</span>
                    )}

                    {isDownloading && (
                      <span className="flex shrink-0 items-center gap-1.5 text-xs" style={{ color: 'var(--accent)' }}>
                        <Loader2 size={12} className="animate-spin" />
                        {prog ? `${prog.percent.toFixed(0)}%` : 'Starting…'}
                      </span>
                    )}
                  </div>

                  {isDownloading && prog && (
                    <div className="mt-3">
                      <ProgressBar value={prog.percent} color="var(--accent)" />
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>
        )}

        {/* ── CLI Integration ── */}
        <div className="mt-14">
          <h2 className="mb-1 text-xl font-bold">CLI Integration</h2>
          <p className="mb-6 text-sm" style={{ color: 'var(--text-muted)' }}>
            Ask questions about your transcripts using Claude CLI or OpenCode CLI.
          </p>

          <div className="flex flex-col gap-3">
            {[
              {
                name: 'Claude CLI',
                id: 'claude',
                detected: cliStatus?.claude ?? false,
                downloadUrl: 'https://claude.ai/download',
                desc: 'Anthropic\'s official CLI — powerful reasoning about transcripts.',
              },
              {
                name: 'OpenCode CLI',
                id: 'opencode',
                detected: cliStatus?.opencode ?? false,
                downloadUrl: 'https://opencode.ai',
                desc: 'OpenCode — fast, open-source AI coding & analysis CLI.',
              },
            ].map(cli => (
              <div
                key={cli.id}
                className="flex items-center justify-between rounded-2xl p-5"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-center gap-3">
                  <Terminal size={20} style={{ color: 'var(--accent)' }} />
                  <div>
                    <p className="font-semibold">{cli.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{cli.desc}</p>
                  </div>
                </div>

                {cli.detected ? (
                  <span className="text-xs font-medium text-green-500 flex items-center gap-1">
                    <CheckCircle size={14} /> Detected
                  </span>
                ) : (
                  <a
                    href={cli.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-all hover:brightness-110"
                    style={{ border: '1px solid var(--border)', color: 'var(--text)' }}
                  >
                    <DownloadIcon size={12} /> Install
                  </a>
                )}
              </div>
            ))}
          </div>

          <p className="mt-4 text-xs" style={{ color: 'var(--text-muted)' }}>
            After installing, restart OWLIA so it can detect the CLI in your PATH.
          </p>
        </div>
      </main>
    </div>
  )
}
