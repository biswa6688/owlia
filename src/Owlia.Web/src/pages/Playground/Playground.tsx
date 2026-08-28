import { useCallback, useEffect, useRef, useState } from 'react'
import { usePlaygroundStore } from '../../store/playgroundStore'
import { useModelStore } from '../../store/modelStore'
import { mediaApi, transcriptApi } from '../../api/client'
import { joinSession, leaveSession } from '../../api/signalr'
import { TranscriptList } from '../../components/Transcript/TranscriptList'
import { SentimentView } from '../../components/Sentiment/SentimentView'
import { SummaryView } from '../../components/Summary/SummaryView'
import { InlinePlayer } from '../../components/InlinePlayer/InlinePlayer'
import { CliPanel } from '../../components/Cli/CliPanel'
import { ModelGate } from '../../components/UI/ModelGateBanner'
import { Nav } from '../../components/Nav/Nav'
import type { SpeakerSegment, SentimentResult, SummaryResult } from '../../api/client'

type RightTab = 'transcript' | 'summary' | 'cli'

export function Playground() {
  const store = usePlaygroundStore()
  const { refresh: refreshModels, isReady } = useModelStore()

  const [rightTab, setRightTab] = useState<RightTab>('transcript')
  const [subtitle, setSubtitle] = useState('')
  const [colPct, setColPct]     = useState(50)
  const containerRef           = useRef<HTMLDivElement>(null)
  const isDraggingCol          = useRef(false)

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDraggingCol.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const pct = ((e.clientX - rect.left) / rect.width) * 100
      setColPct(Math.min(80, Math.max(20, pct)))
    }
    const onUp = () => { isDraggingCol.current = false; document.body.style.cursor = ''; document.body.style.userSelect = '' }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
  }, [])

  useEffect(() => { refreshModels() }, [refreshModels])

  // ── Session restore ────────────────────────────────────────────────
  useEffect(() => {
    const { sessionId, segments } = store
    if (!sessionId || segments.length > 0) return
    Promise.allSettled([
      transcriptApi.get(sessionId),
      transcriptApi.getSentiment(sessionId),
      transcriptApi.getSummary(sessionId),
    ]).then(([t, s, sum]) => {
      if (t.status === 'fulfilled' && t.value?.segments?.length) {
        store.setSegments(t.value.segments)
        store.setStage('done', 100)
      }
      if (s.status   === 'fulfilled' && s.value)   store.setSentiment(s.value as SentimentResult)
      if (sum.status === 'fulfilled' && sum.value)  store.setSummary(sum.value as SummaryResult)
    }).catch(() => {})
    return () => { if (store.sessionId) leaveSession(store.sessionId) }
  }, [store.sessionId])

  // ── Seek ────────────────────────────────────────────────────────────
  const onSeek = useCallback((ms: number) => {
    store.setCurrentTimeMs(ms)
    const seg = store.segments.find(s => ms >= s.startMs && ms <= s.endMs)
    setSubtitle(seg?.text ?? '')
  }, [store])

  // ── File load ──────────────────────────────────────────────────────
  const loadFile = (f: File) => {
    store.reset(); store.setMediaFile(f); setSubtitle('')
  }

  // ── Analyse ────────────────────────────────────────────────────────
  const analyse = async () => {
    if (!store.mediaFile || !isReady('transcribe')) return
    store.setStage('audio', 0)
    try {
      const fp: string = (store.mediaFile as any).path ?? store.mediaFile.name
      const { sessionId } = await mediaApi.analyze(fp)
      store.setSessionId(sessionId)
      const hub = await joinSession(sessionId)
      hub.off('AnalysisProgress'); hub.off('TranscriptSegment')
      hub.off('AnalysisComplete'); hub.off('AnalysisError')

      hub.on('AnalysisProgress', (d: { stage: string; percent: number }) =>
        store.setStage(d.stage as any, d.percent))
      hub.on('TranscriptSegment', (seg: SpeakerSegment) => store.addSegment(seg))
      hub.on('AnalysisComplete', async () => {
        store.setStage('done', 100)
        const [sr, sumr] = await Promise.allSettled([
          transcriptApi.getSentiment(sessionId),
          transcriptApi.getSummary(sessionId),
        ])
        if (sr.status   === 'fulfilled') store.setSentiment(sr.value as SentimentResult)
        if (sumr.status === 'fulfilled') store.setSummary(sumr.value as SummaryResult)
        leaveSession(sessionId); refreshModels()
      })
      hub.on('AnalysisError', (d: { error: string }) => {
        store.setError(d.error); leaveSession(sessionId)
      })
    } catch (e: any) {
      store.setError(e?.response?.data?.error ?? e?.message ?? 'Unknown error')
    }
  }

  const STAGE_LABEL: Record<string, string> = {
    idle: '', audio: 'Loading audio…', vad: 'Detecting speech…',
    asr: 'Transcribing…', diarization: 'Identifying speakers…',
    sentiment: 'Analysing sentiment…', saving: 'Saving…',
    summary: 'Summarising…', done: 'Complete', error: 'Error',
  }

  const isAnalysing = !['idle', 'done', 'error'].includes(store.stage)
  const canAnalyse  = !!store.mediaFile && store.stage === 'idle' && isReady('transcribe')
  const needsModel  = !!store.mediaFile && store.stage === 'idle' && !isReady('transcribe')
  const totalDurMs  = store.segments.length
    ? Math.max(...store.segments.map(s => s.endMs))
    : store.sentiment?.timeline?.length
      ? Math.max(...store.sentiment.timeline.map(s => s.endMs))
      : 0

  const RIGHT_TABS: { id: RightTab; label: string }[] = [
    { id: 'transcript', label: 'Transcript' },
    { id: 'summary',    label: 'Summary'    },
    { id: 'cli',        label: '🤖 Ask AI'  },
  ]

  return (
    <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--text)', overflow: 'hidden' }}>
      <Nav />

      {/* ── Two-column body ────────────────────────────────────────────── */}
      <div ref={containerRef} style={{ flex: '1 1 0', minHeight: 0, display: 'flex', overflow: 'hidden' }}>

        {/* ── Left column: Player + Sentiment ──────────────────────────── */}
        <div style={{ width: `${colPct}%`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Inline media player */}
          <div style={{ flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
            <InlinePlayer
              mediaUrl={store.mediaUrl}
              mediaFile={store.mediaFile}
              subtitle={subtitle}
              onFileLoad={loadFile}
              onSeek={onSeek}
              onAnalyse={canAnalyse ? analyse : undefined}
              canAnalyse={canAnalyse}
              needsModel={needsModel}
              isAnalysing={isAnalysing}
              stageLabel={isAnalysing ? STAGE_LABEL[store.stage] : undefined}
              progress={isAnalysing ? store.progress : undefined}
            />
          </div>

          {/* Sentiment section */}
          <div style={{ flex: '1 1 0', minHeight: 0, overflow: 'auto', padding: '12px 16px' }}>
            <ModelGate feature="sentiment">
              <SentimentView sentiment={store.sentiment} totalDurationMs={totalDurMs} />
            </ModelGate>
          </div>
        </div>

        {/* ── Draggable divider ──────────────────────────────────────────── */}
        <div
          onMouseDown={() => { isDraggingCol.current = true; document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none' }}
          style={{ width: 5, flexShrink: 0, cursor: 'col-resize', background: 'var(--border)', transition: 'background 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onMouseEnter={e => { if (!isDraggingCol.current) e.currentTarget.style.background = 'var(--accent)' }}
          onMouseLeave={e => { if (!isDraggingCol.current) e.currentTarget.style.background = 'var(--border)' }}
        >
          <div style={{ width: 1, height: 24, background: 'var(--text)', opacity: 0.15, borderRadius: 1 }} />
        </div>

        {/* ── Right column: Tabs ───────────────────────────────────────── */}
        <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Tab bar */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)', flexShrink: 0 }}>
            {RIGHT_TABS.map(t => (
              <button
                key={t.id} type="button" onClick={() => setRightTab(t.id)}
                style={{
                  padding: '8px 14px', fontSize: '0.75rem', fontWeight: 600,
                  background: 'none', border: 'none', cursor: 'pointer',
                  color:        rightTab === t.id ? 'var(--accent)' : 'var(--text-muted)',
                  borderBottom: rightTab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
                  transition: 'color 0.15s', whiteSpace: 'nowrap',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            {rightTab === 'transcript' && (
              <ModelGate feature="transcribe">
                <TranscriptList segments={store.segments} activeIndex={store.activeSegmentIndex} onSeek={ms => {
                  store.setCurrentTimeMs(ms)
                  setSubtitle(store.segments.find(s => ms >= s.startMs && ms <= s.endMs)?.text ?? '')
                }} />
              </ModelGate>
            )}
            {rightTab === 'summary' && (
              <ModelGate feature="summary">
                <SummaryView summary={store.summary} />
              </ModelGate>
            )}
            {rightTab === 'cli' && <CliPanel sessionId={store.sessionId} />}
          </div>
        </div>
      </div>
    </div>
  )
}
