import { useEffect, useRef, useState } from 'react'
import { Send, Terminal, Loader2, AlertCircle } from 'lucide-react'
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

export function CliPanel({ sessionId }: Props) {
  const [cliStatus, setCliStatus] = useState<CliStatus | null>(null)
  const [selectedCli, setSelectedCli] = useState<'claude' | 'opencode'>('claude')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const hubRef = useRef<HubConnection | null>(null)
  const currentTextRef = useRef('')

  // Load CLI status on mount
  useEffect(() => {
    cliApi.status()
      .then(s => {
        setCliStatus(s)
        setSelectedCli(s.claude ? 'claude' : 'opencode')
      })
      .catch(() => {})
  }, [])

  // Subscribe to SignalR CliResponse events for this session
  useEffect(() => {
    if (!sessionId) return
    let active = true

    joinSession(sessionId).then(hub => {
      if (!active) return
      hubRef.current = hub

      // Remove any prior handlers before re-registering (prevents duplicates)
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

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const noCli = cliStatus !== null && !cliStatus.claude && !cliStatus.opencode

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

  // ── Render ─────────────────────────────────────────────────────────────

  if (!sessionId) {
    return (
      <div className="flex h-full items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
        Analyse a media file first to enable CLI queries.
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col" style={{ color: 'var(--text)' }}>

      {/* Header */}
      <div
        className="flex shrink-0 items-center justify-between px-4 py-2 text-xs"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <span className="flex items-center gap-1.5 font-semibold" style={{ color: 'var(--accent)' }}>
          <Terminal size={13} /> CLI Query
        </span>

        {cliStatus && !noCli && (
          <div className="flex gap-1">
            {cliStatus.claude && (
              <button type="button" onClick={() => setSelectedCli('claude')}
                className="rounded-full px-2.5 py-1 text-xs font-medium transition-colors"
                style={selectedCli === 'claude'
                  ? { background: 'var(--accent)', color: '#1a1210' }
                  : { background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                Claude
              </button>
            )}
            {cliStatus.opencode && (
              <button type="button" onClick={() => setSelectedCli('opencode')}
                className="rounded-full px-2.5 py-1 text-xs font-medium transition-colors"
                style={selectedCli === 'opencode'
                  ? { background: 'var(--accent)', color: '#1a1210' }
                  : { background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                OpenCode
              </button>
            )}
          </div>
        )}
      </div>

      {/* No CLI banner */}
      {noCli && (
        <div className="mx-4 mt-3 shrink-0 flex items-start gap-2 rounded-xl p-3 text-xs"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
          <AlertCircle size={13} className="mt-0.5 shrink-0" />
          <span>
            No CLI detected. Install{' '}
            <a href="https://claude.ai/download" target="_blank" rel="noopener noreferrer" className="underline">Claude CLI</a>
            {' '}or{' '}
            <a href="https://opencode.ai" target="_blank" rel="noopener noreferrer" className="underline">OpenCode</a>,
            then restart OWLIA.
          </span>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 && !noCli && (
          <p className="text-center text-xs" style={{ color: 'var(--text-muted)' }}>
            Ask anything about the transcript — e.g. "What were the main topics discussed?"
          </p>
        )}

        <div className="flex flex-col gap-3">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className="max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap"
                style={msg.role === 'user'
                  ? { background: 'var(--accent)', color: '#1a1210' }
                  : { background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
              >
                {msg.text}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl px-3 py-2 text-xs"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                <Loader2 size={13} className="animate-spin" /> Thinking…
              </div>
            </div>
          )}

          {error && <p className="text-center text-xs text-red-400">{error}</p>}
        </div>
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 p-3" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="flex items-end gap-2 rounded-xl px-3 py-2"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder={noCli ? 'Install a CLI to use this feature' : 'Ask a question about the transcript…'}
            disabled={loading || !!noCli}
            className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:opacity-40 disabled:opacity-40"
            style={{ color: 'var(--text)', maxHeight: 96 }}
          />
          <button type="button" onClick={sendQuery}
            disabled={!input.trim() || loading || !!noCli}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all disabled:opacity-30 hover:brightness-110"
            style={{ background: 'var(--accent)' }}>
            <Send size={13} style={{ color: '#1a1210' }} />
          </button>
        </div>
        <p className="mt-1 text-center text-[10px]" style={{ color: 'var(--text-muted)' }}>
          Enter to send · Shift+Enter for newline
        </p>
      </div>
    </div>
  )
}
