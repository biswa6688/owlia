import { useEffect, useRef, useState } from 'react'
import { Send, Terminal, Loader2, AlertCircle, ChevronDown, Check } from '../Icons/icons'
import type { HubConnection } from '@microsoft/signalr'
import { cliApi, type CliStatus } from '../../api/client'
import { joinSession } from '../../api/signalr'

interface Message {
  role: 'user' | 'assistant'
  text: string
}

interface Props {
  sessionId: string | null
}

const CLI_META: Record<string, { label: string; icon: string; color: string }> = {
  claude:   { label: 'Claude',   icon: 'C', color: '#d97706' },
  opencode: { label: 'OpenCode', icon: 'O', color: '#6366f1' },
}

export function CliPanel({ sessionId }: Props) {
  const [cliStatus, setCliStatus] = useState<CliStatus | null>(null)
  const [selectedCli, setSelectedCli] = useState<'claude' | 'opencode'>('claude')
  const [cliDropdown, setCliDropdown] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const hubRef = useRef<HubConnection | null>(null)
  const currentTextRef = useRef('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    cliApi.status()
      .then(s => {
        setCliStatus(s)
        setSelectedCli(s.claude ? 'claude' : 'opencode')
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!sessionId) return
    let active = true

    joinSession(sessionId).then(hub => {
      if (!active) return
      hubRef.current = hub

      hub.off('CliResponse')
      hub.off('CliError')

      hub.on('CliResponse', (data: { chunk?: string; done?: boolean }) => {
        if (data.done) {
          setLoading(false)
          currentTextRef.current = ''
          return
        }
        if (data.chunk) {
          currentTextRef.current += data.chunk
          const snapshot = currentTextRef.current
          setMessages(prev => {
            const updated = [...prev]
            const last = updated[updated.length - 1]
            if (last?.role === 'assistant') {
              updated[updated.length - 1] = { role: 'assistant', text: snapshot }
            } else {
              updated.push({ role: 'assistant', text: snapshot })
            }
            return updated
          })
        }
      })

      hub.on('CliError', (data: { error: string }) => {
        setError(data.error)
        setLoading(false)
      })
    })

    return () => { active = false }
  }, [sessionId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Close dropdown on outside click
  useEffect(() => {
    if (!cliDropdown) return
    const h = (e: MouseEvent) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setCliDropdown(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [cliDropdown])

  const noCli = cliStatus !== null && !cliStatus.claude && !cliStatus.opencode
  const meta = CLI_META[selectedCli]
  const version = selectedCli === 'claude' ? cliStatus?.claudeVersion : cliStatus?.opencodeVersion

  const sendQuery = async () => {
    const q = input.trim()
    if (!q || !sessionId || loading || noCli) return
    setMessages(prev => [...prev, { role: 'user', text: q }])
    setInput('')
    setLoading(true)
    setError(null)
    currentTextRef.current = ''
    try {
      await cliApi.query(sessionId, q, selectedCli)
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err?.message ?? 'Query failed')
      setLoading(false)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendQuery() }
  }

  if (!sessionId) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', color: 'var(--text)', background: 'var(--bg)' }}>
        {/* ── Top bar ──────────────────────────────────────────────────── */}
        <div style={{ flexShrink: 0, padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: `${meta.color}18`, border: `1px solid ${meta.color}33`,
              fontWeight: 800, fontSize: '0.85rem', color: meta.color,
            }}>
              {meta.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '0.82rem' }}>{meta.label}</div>
              {version && (
                <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {version}
                </div>
              )}
            </div>
            {cliStatus && !noCli && (
              <div ref={dropdownRef} style={{ position: 'relative' }}>
                <button type="button" onClick={() => setCliDropdown(v => !v)}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 8, cursor: 'pointer', background: 'var(--bg)', border: '1px solid var(--border)', fontSize: '0.68rem', fontWeight: 600, color: 'var(--text)' }}>
                  {meta.label}
                  <ChevronDown size={10} style={{ opacity: 0.5, transform: cliDropdown ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.15s' }} />
                </button>
                {cliDropdown && (
                  <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 50, minWidth: 150, borderRadius: 10, overflow: 'hidden', background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
                    {Object.entries(CLI_META).filter(([k]) => cliStatus?.[k as keyof CliStatus]).map(([key, m]) => (
                      <button key={key} type="button" onClick={() => { setSelectedCli(key as 'claude' | 'opencode'); setCliDropdown(false) }}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', cursor: 'pointer', background: key === selectedCli ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent', border: 'none', textAlign: 'left', fontSize: '0.75rem', fontWeight: key === selectedCli ? 700 : 500, color: key === selectedCli ? 'var(--accent)' : 'var(--text)' }}>
                        <div style={{ width: 22, height: 22, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${m.color}18`, fontWeight: 800, fontSize: '0.7rem', color: m.color }}>{m.icon}</div>
                        <span>{m.label}</span>
                        {key === selectedCli && <span style={{ marginLeft: 'auto', opacity: 0.5 }}><Check size={10} /></span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Empty chat state ─────────────────────────────────────────── */}
        <div style={{ flex: '1 1 0', minHeight: 0, overflow: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${meta.color}12`, border: `1px solid ${meta.color}25` }}>
            <Terminal size={18} style={{ color: meta.color, opacity: 0.5 }} />
          </div>
          <p style={{ fontSize: '0.78rem', fontWeight: 600, margin: 0, opacity: 0.5 }}>Waiting for analysis</p>
          <p style={{ fontSize: '0.70rem', color: 'var(--text-muted)', margin: 0, maxWidth: 220, opacity: 0.5 }}>
            Drop a media file and click Analyse to start chatting with your transcript.
          </p>
        </div>

        {/* ── Disabled input ────────────────────────────────────────────── */}
        <div style={{ flexShrink: 0, padding: '10px 12px', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, padding: '8px 10px', borderRadius: 12, background: 'var(--bg)', border: '1px solid var(--border)', opacity: 0.55 }}>
            <textarea value="" readOnly rows={1} placeholder="Run analysis to start chatting…"
              style={{ flex: 1, resize: 'none', background: 'transparent', outline: 'none', fontSize: '0.80rem', color: 'var(--text)', maxHeight: 80, opacity: 1, fontFamily: 'inherit', cursor: 'not-allowed' }} />
            <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--border)', border: 'none' }}>
              <Send size={12} style={{ color: 'var(--text-muted)' }} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', color: 'var(--text)', background: 'var(--bg)' }}>

      {/* ── Top bar: CLI info ──────────────────────────────────────────── */}
      <div style={{ flexShrink: 0, padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* CLI avatar */}
          <div style={{
            width: 32, height: 32, borderRadius: 10, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `${meta.color}18`, border: `1px solid ${meta.color}33`,
            fontWeight: 800, fontSize: '0.85rem', color: meta.color,
          }}>
            {meta.icon}
          </div>

          {/* CLI name + version */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '0.82rem' }}>{meta.label}</div>
            {version && (
              <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {version}
              </div>
            )}
          </div>

          {/* CLI switcher dropdown */}
          {cliStatus && !noCli && (
            <div ref={dropdownRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setCliDropdown(v => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '4px 8px', borderRadius: 8, cursor: 'pointer',
                  background: 'var(--bg)', border: '1px solid var(--border)',
                  fontSize: '0.68rem', fontWeight: 600, color: 'var(--text)',
                }}
              >
                {meta.label}
                <ChevronDown size={10} style={{ opacity: 0.4, transform: cliDropdown ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.15s' }} />
              </button>

              {cliDropdown && (
                <div style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 50,
                  minWidth: 150, borderRadius: 10, overflow: 'hidden',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                }}>
                  {Object.entries(CLI_META).filter(([k]) => cliStatus?.[k as keyof CliStatus]).map(([key, m]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => { setSelectedCli(key as 'claude' | 'opencode'); setCliDropdown(false) }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        width: '100%', padding: '8px 12px', cursor: 'pointer',
                        background: key === selectedCli ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
                        border: 'none', textAlign: 'left',
                        fontSize: '0.75rem', fontWeight: key === selectedCli ? 700 : 500,
                        color: key === selectedCli ? 'var(--accent)' : 'var(--text)',
                      }}
                    >
                      <div style={{
                        width: 22, height: 22, borderRadius: 6,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: `${m.color}18`, fontWeight: 800, fontSize: '0.7rem', color: m.color,
                      }}>
                        {m.icon}
                      </div>
                      <span>{m.label}</span>
                      {key === selectedCli && <span style={{ marginLeft: 'auto', opacity: 0.5 }}><Check size={10} /></span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── No CLI banner ──────────────────────────────────────────────── */}
      {noCli && (
        <div style={{ margin: '8px 10px', padding: '8px 10px', borderRadius: 8, fontSize: '0.72rem', display: 'flex', alignItems: 'flex-start', gap: 6, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
          <AlertCircle size={12} style={{ marginTop: 1, flexShrink: 0 }} />
          <span>
            No CLI detected. Install{' '}
            <a href="https://claude.ai/download" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline', color: '#f87171' }}>Claude CLI</a>
            {' '}or{' '}
            <a href="https://opencode.ai" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline', color: '#f87171' }}>OpenCode</a>.
          </span>
        </div>
      )}

      {/* ── Messages ───────────────────────────────────────────────────── */}
      <div style={{ flex: '1 1 0', minHeight: 0, overflow: 'auto', padding: '12px 14px' }}>
        {messages.length === 0 && !noCli && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8, textAlign: 'center' }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: `${meta.color}12`, border: `1px solid ${meta.color}25`,
            }}>
              <Terminal size={18} style={{ color: meta.color, opacity: 0.6 }} />
            </div>
            <p style={{ fontSize: '0.78rem', fontWeight: 600, margin: 0 }}>Ask anything</p>
            <p style={{ fontSize: '0.70rem', color: 'var(--text-muted)', margin: 0, maxWidth: 220 }}>
              Questions about the transcript — topics, speakers, sentiment, or summary.
            </p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '85%', borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                padding: '8px 12px', fontSize: '0.80rem', lineHeight: 1.55, whiteSpace: 'pre-wrap',
                ...(msg.role === 'user'
                  ? { background: 'var(--accent)', color: '#1a1210' }
                  : { background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }),
              }}>
                {msg.text}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                borderRadius: '14px 14px 14px 4px', padding: '8px 12px',
                background: 'var(--surface)', border: '1px solid var(--border)',
                fontSize: '0.75rem', color: 'var(--text-muted)',
              }}>
                <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                <span>Thinking…</span>
              </div>
            </div>
          )}

          {error && (
            <div style={{ padding: '6px 10px', borderRadius: 8, fontSize: '0.72rem', background: 'rgba(239,68,68,0.1)', color: '#f87171', textAlign: 'center' }}>
              {error}
            </div>
          )}
        </div>
        <div ref={bottomRef} />
      </div>

      {/* ── Input area ─────────────────────────────────────────────────── */}
      <div style={{ flexShrink: 0, padding: '10px 12px', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div style={{
          display: 'flex', alignItems: 'flex-end', gap: 8,
          padding: '8px 10px', borderRadius: 12,
          background: 'var(--bg)', border: '1px solid var(--border)',
        }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder={noCli ? 'Install a CLI to use this feature' : 'Ask a question…'}
            disabled={loading || !!noCli}
            style={{
              flex: 1, resize: 'none', background: 'transparent', outline: 'none',
              fontSize: '0.80rem', color: 'var(--text)', maxHeight: 80,
              opacity: loading || noCli ? 0.4 : 1, fontFamily: 'inherit',
            }}
          />
          <button type="button" onClick={sendQuery}
            disabled={!input.trim() || loading || !!noCli}
            style={{
              width: 28, height: 28, borderRadius: 8, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: input.trim() && !loading && !noCli ? 'var(--accent)' : 'var(--border)',
              border: 'none', cursor: input.trim() && !loading && !noCli ? 'pointer' : 'default',
              transition: 'background 0.15s',
            }}>
            <Send size={12} style={{ color: input.trim() && !loading ? '#1a1210' : 'var(--text-muted)' }} />
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, padding: '0 2px' }}>
          <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>
            Enter to send · Shift+Enter newline
          </span>
          {version && (
            <span style={{ fontSize: '0.60rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
              {version}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
