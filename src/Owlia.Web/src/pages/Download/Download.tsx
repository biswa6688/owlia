import { useState, useEffect, useCallback } from 'react'
import { cliApi, modelsApi, updatesApi, type CliStatus, type CliUpdateInfo, type ModelUpdateInfo } from '../../api/client'
import { useModelStore } from '../../store/modelStore'
import { useSettingsStore } from '../../store/settingsStore'
import { startHub, getHub } from '../../api/signalr'
import { Nav } from '../../components/Nav/Nav'
import { ProgressBar } from '../../components/UI/ProgressBar'
import {
  Terminal, CheckCircle, Copy, Check, Cpu,
  DownloadIcon, Mic, Users, BarChart2, FileText, Volume2, Activity, AlertCircle, Loader2, Pause, X, RefreshCw,
} from '../../components/Icons/icons'

const CLIS = [
  { name: 'Claude Code', slug: 'claude' as const, icon: Terminal, color: 'var(--accent)', desc: 'Anthropic CLI agent', installCmd: 'npm install -g @anthropic-ai/claude-code' },
  { name: 'OpenCode', slug: 'opencode' as const, icon: Cpu, color: 'var(--accent-copper)', desc: 'Open-source CLI agent', installCmd: 'npm install -g opencode' },
] as const

const MODEL_ICONS: Record<string, typeof Mic> = {
  'silero-vad': Activity,
  'whisper-large-v3': Mic,
  'pyannote-seg': Users,
  'wespeaker-ecapa': Users,
  'roberta-sentiment': BarChart2,
  'bart-cnn': FileText,
  'kokoro-tts': Volume2,
}

function formatBytes(n: number) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} GB`
  if (n >= 1e6) return `${(n / 1e6).toFixed(0)} MB`
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)} KB`
  return `${n} B`
}

interface DownloadState {
  percent: number
  paused?: boolean
  error?: string
}

export default function DownloadPage() {
  const [cliData, setCliData]   = useState<CliStatus | null>(null)
  const [copied, setCopied]     = useState<string | null>(null)
  const { models, refresh } = useModelStore()
  const [downloading, setDownloading] = useState<Record<string, DownloadState>>({})
  const { checkForUpdates, setCheckForUpdates } = useSettingsStore()
  const [updateInfo, setUpdateInfo] = useState<{ cli: CliUpdateInfo[]; models: ModelUpdateInfo[] } | null>(null)
  const [checkingUpdates, setCheckingUpdates] = useState(false)

  const fetchCli = useCallback(async () => {
    try {
      const s = await cliApi.status()
      setCliData(s)
    } catch { /* ok */ }
  }, [])

  useEffect(() => { fetchCli(); refresh() }, [fetchCli, refresh])

  const checkUpdates = useCallback(async () => {
    setCheckingUpdates(true)
    try {
      const info = await updatesApi.check()
      setUpdateInfo(info)
    } catch { /* offline or check failed — leave previous result, if any */ }
    finally { setCheckingUpdates(false) }
  }, [])

  // Only checks when the user has opted in — never automatic/silent, and
  // never downloads anything itself, just reports what's available.
  useEffect(() => {
    if (checkForUpdates) checkUpdates()
  }, [checkForUpdates, checkUpdates])

  // Seed paused state from the server on load/refresh — a model can already be
  // sitting mid-download (partial ".tmp" file) from a previous app session.
  useEffect(() => {
    setDownloading(prev => {
      let changed = false
      const next = { ...prev }
      for (const m of models) {
        if (m.isPaused && !next[m.id]) {
          next[m.id] = { percent: m.sizeBytes > 0 ? (m.partialBytes / m.sizeBytes) * 100 : 0, paused: true }
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [models])

  useEffect(() => {
    let cancelled = false

    startHub().then(() => {
      if (cancelled) return
      const hub = getHub()

      hub.on('ModelDownloadProgress', (data: { modelId: string; percent: number; complete?: boolean }) => {
        if (data.complete) {
          setDownloading(prev => {
            const next = { ...prev }
            delete next[data.modelId]
            return next
          })
          refresh()
        } else {
          setDownloading(prev => ({ ...prev, [data.modelId]: { percent: data.percent } }))
        }
      })

      hub.on('ModelDownloadPaused', (data: { modelId: string }) => {
        setDownloading(prev => ({ ...prev, [data.modelId]: { percent: prev[data.modelId]?.percent ?? 0, paused: true } }))
      })

      hub.on('ModelDownloadCancelled', (data: { modelId: string }) => {
        setDownloading(prev => {
          const next = { ...prev }
          delete next[data.modelId]
          return next
        })
        refresh()
      })

      hub.on('ModelDownloadError', (data: { modelId: string; error: string }) => {
        setDownloading(prev => ({ ...prev, [data.modelId]: { percent: prev[data.modelId]?.percent ?? 0, error: data.error } }))
      })
    })

    return () => {
      cancelled = true
      const hub = getHub()
      hub.off('ModelDownloadProgress')
      hub.off('ModelDownloadPaused')
      hub.off('ModelDownloadCancelled')
      hub.off('ModelDownloadError')
    }
  }, [refresh])

  const copyCmd = (cmd: string, slug: string) => {
    navigator.clipboard.writeText(cmd)
    setCopied(slug)
    setTimeout(() => setCopied(null), 2000)
  }

  const startDownload = async (modelId: string) => {
    // Preserve percent if resuming from a paused state — avoids a flash back to 0%.
    setDownloading(prev => ({ ...prev, [modelId]: { percent: prev[modelId]?.percent ?? 0 } }))
    try {
      await modelsApi.download(modelId)
    } catch (err) {
      setDownloading(prev => ({ ...prev, [modelId]: { percent: 0, error: err instanceof Error ? err.message : 'Failed to start download' } }))
    }
  }

  const pauseDownload = async (modelId: string) => {
    try { await modelsApi.pause(modelId) } catch { /* ignore */ }
  }

  const cancelDownload = async (modelId: string) => {
    try {
      await modelsApi.cancel(modelId)
    } finally {
      setDownloading(prev => {
        const next = { ...prev }
        delete next[modelId]
        return next
      })
      refresh()
    }
  }

  return (
    <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--text)', overflow: 'hidden' }}>
      <Nav />

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ maxWidth: 640, width: '100%' }}>

          {/* Hero */}
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 6 }}>
              Download <span style={{ color: 'var(--accent)' }}>ONNX models</span>
            </h1>
            <p style={{ fontSize: '0.82rem', opacity: 0.55 }}>
              Required once, offline forever. Playground features unlock as their models finish.
            </p>
          </div>

          {/* Settings — update check (opt-in, manual, never auto-downloads) */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
            padding: '10px 14px', marginBottom: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.76rem' }}>
                <input
                  type="checkbox"
                  checked={checkForUpdates}
                  onChange={e => setCheckForUpdates(e.target.checked)}
                  style={{ accentColor: 'var(--accent)', width: 14, height: 14, cursor: 'pointer' }}
                />
                Check for CLI &amp; model updates
              </label>
              <span style={{ fontSize: '0.64rem', opacity: 0.4 }}>Never auto-downloads — you decide when to update.</span>
            </div>
            <button
              type="button"
              onClick={checkUpdates}
              disabled={checkingUpdates}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 999,
                fontSize: '0.68rem', fontWeight: 600, background: 'var(--surface-2)', border: '1px solid var(--border)',
                cursor: checkingUpdates ? 'default' : 'pointer', color: 'var(--text)', opacity: checkingUpdates ? 0.6 : 1,
              }}
            >
              <RefreshCw size={11} className={checkingUpdates ? 'animate-spin' : ''} /> Check now
            </button>
          </div>

          {/* Models list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 36 }}>
            {models.length === 0 && (
              <p style={{ fontSize: '0.78rem', opacity: 0.5 }}>Loading model status…</p>
            )}
            {models.map(model => {
              const Icon = MODEL_ICONS[model.id] ?? DownloadIcon
              const state = downloading[model.id]
              const isPaused = !!state?.paused && !state.error
              const isDownloading = !!state && !state.error && !isPaused
              const modelUpdate = updateInfo?.models.find(m => m.id === model.id)

              return (
                <div
                  key={model.id}
                  style={{
                    background: 'var(--surface)',
                    border: `1px solid ${model.downloaded ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 10, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'color-mix(in srgb, var(--accent) 10%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={16} style={{ color: 'var(--accent)' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 700, fontSize: '0.85rem', lineHeight: 1.2, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {model.displayName || model.id}
                        {modelUpdate?.updateAvailable && (
                          <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '1px 6px', borderRadius: 999, background: 'color-mix(in srgb, var(--accent) 20%, transparent)', color: 'var(--accent)' }}>
                            Update available
                          </span>
                        )}
                      </p>
                      <p style={{ fontSize: '0.68rem', opacity: 0.45 }}>{model.feature} · {formatBytes(model.sizeBytes)}</p>
                    </div>

                    {model.downloaded ? (
                      <CheckCircle size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    ) : isDownloading ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <Loader2 size={16} className="animate-spin" style={{ color: 'var(--accent)' }} />
                        <button
                          type="button"
                          title="Pause"
                          onClick={() => pauseDownload(model.id)}
                          style={{ display: 'flex', padding: 5, borderRadius: 999, background: 'var(--surface-2)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text)' }}
                        >
                          <Pause size={12} />
                        </button>
                        <button
                          type="button"
                          title="Cancel"
                          onClick={() => cancelDownload(model.id)}
                          style={{ display: 'flex', padding: 5, borderRadius: 999, background: 'var(--surface-2)', border: '1px solid var(--border)', cursor: 'pointer', color: '#ef4444' }}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : isPaused ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => startDownload(model.id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '5px 12px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 600,
                            background: 'var(--accent)', color: '#1a1210', border: 'none', cursor: 'pointer',
                          }}
                        >
                          <DownloadIcon size={12} /> Resume
                        </button>
                        <button
                          type="button"
                          title="Cancel"
                          onClick={() => cancelDownload(model.id)}
                          style={{ display: 'flex', padding: 5, borderRadius: 999, background: 'var(--surface-2)', border: '1px solid var(--border)', cursor: 'pointer', color: '#ef4444' }}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startDownload(model.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '5px 12px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 600,
                          background: 'var(--accent)', color: '#1a1210', border: 'none', cursor: 'pointer',
                        }}
                      >
                        <DownloadIcon size={12} /> Download
                      </button>
                    )}
                  </div>

                  {(isDownloading || isPaused) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <ProgressBar value={state.percent} color={isPaused ? 'var(--text-muted)' : 'var(--accent)'} className="flex-1" />
                      <span style={{ fontSize: '0.65rem', opacity: 0.5, minWidth: 60, textAlign: 'right' }}>
                        {isPaused ? 'Paused · ' : ''}{Math.round(state.percent)}%
                      </span>
                    </div>
                  )}

                  {state?.error && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.68rem', color: '#ef4444' }}>
                      <AlertCircle size={12} /> {state.error}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* CLI section */}
          <div style={{ marginBottom: 12 }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 4 }}>
              Install <span style={{ color: 'var(--accent)' }}>CLI</span> agents
            </h2>
            <p style={{ fontSize: '0.78rem', opacity: 0.5 }}>
              Optional. Background agents that power the Ask AI tab.
            </p>
          </div>

          {/* CLI Cards — 2-column grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 32 }}>
            {CLIS.map(({ name, slug, icon: Icon, color, desc, installCmd }) => {
              const installed = slug === 'claude' ? cliData?.claude : cliData?.opencode
              const version = slug === 'claude' ? cliData?.claudeVersion : cliData?.opencodeVersion
              const cliUpdate = updateInfo?.cli.find(c => c.slug === slug)

              return (
                <div
                  key={slug}
                  style={{
                    background: 'var(--surface)',
                    border: `1px solid ${installed ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10,
                    transition: 'border-color 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: `color-mix(in srgb, ${color} 10%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={16} style={{ color }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 700, fontSize: '0.85rem', lineHeight: 1.2 }}>{name}</p>
                      <p style={{ fontSize: '0.68rem', opacity: 0.45 }}>{desc}</p>
                    </div>
                    {installed && <CheckCircle size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
                  </div>

                  {installed ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.68rem', color: 'var(--accent)', fontWeight: 600 }}>Detected</span>
                      {version && <span style={{ fontSize: '0.62rem', opacity: 0.35 }}>({version})</span>}
                      {cliUpdate?.updateAvailable && (
                        <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '1px 6px', borderRadius: 999, background: 'color-mix(in srgb, var(--accent) 20%, transparent)', color: 'var(--accent)' }}>
                          v{cliUpdate.latestVersion} available
                        </span>
                      )}
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.68rem', opacity: 0.45 }}>Not detected — install manually</div>
                  )}

                  <div
                    onClick={() => copyCmd(installCmd, slug)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderRadius: 6, background: 'var(--bg)', cursor: 'pointer', border: '1px solid var(--border)', transition: 'border-color 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = color }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
                  >
                    <code style={{ flex: 1, fontSize: '0.62rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {installCmd}
                    </code>
                    {copied === slug ? <Check size={10} style={{ color: 'var(--accent)', flexShrink: 0 }} /> : <Copy size={10} style={{ opacity: 0.3, flexShrink: 0 }} />}
                  </div>
                </div>
              )
            })}
          </div>

          {/* FAQ */}
          <div style={{ marginTop: 8 }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 14 }}>Questions?</h2>
            {[
              { q: 'Are CLIs required?', a: 'Optional. Owlia works fully offline. CLIs add background agent capabilities.' },
              { q: 'Is it safe?', a: 'Yes. CLIs run locally, no data leaves your machine.' },
              { q: 'Can I uninstall?', a: 'Yes. Remove with npm uninstall -g.' },
            ].map(({ q, a }) => (
              <div key={q} style={{ padding: '10px 0', borderTop: '1px solid var(--border)' }}>
                <p style={{ fontWeight: 600, fontSize: '0.80rem', marginBottom: 2 }}>{q}</p>
                <p style={{ fontSize: '0.78rem', opacity: 0.50 }}>{a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
