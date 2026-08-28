import { useCallback, useEffect, useState } from 'react'
import { usePlaygroundStore } from '../../store/playgroundStore'
import { useModelStore } from '../../store/modelStore'
import { mediaApi, transcriptApi } from '../../api/client'
import { joinSession, leaveSession } from '../../api/signalr'
import { TranscriptList } from '../../components/Transcript/TranscriptList'
import { SentimentView } from '../../components/Sentiment/SentimentView'
import { SummaryView } from '../../components/Summary/SummaryView'
import { FloatingPlayer } from '../../components/FloatingPlayer/FloatingPlayer'
import { CliPanel } from '../../components/Cli/CliPanel'
import { ModelGate } from '../../components/UI/ModelGateBanner'
import { Nav } from '../../components/Nav/Nav'
import type { SpeakerSegment, SentimentResult, SummaryResult } from '../../api/client'

type Tab = 'transcript' | 'sentiment' | 'summary' | 'cli'

export function Playground() {
  const store = usePlaygroundStore()
  const { refresh: refreshModels, isReady } = useModelStore()

  const [tab, setTab]               = useState<Tab>('transcript')
  const [subtitle, setSubtitle]     = useState('')

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
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Subtitle lookup ────────────────────────────────────────────────
  const onSeek = useCallback((ms: number) => {
    store.setCurrentTimeMs(ms)
    setSubtitle(store.segments.find(s => ms >= s.startMs && ms <= s.endMs)?.text ?? '')
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
  const totalDurMs  = 0 // duration tracked inside FloatingPlayer

  const TABS: { id: Tab; label: string }[] = [
    { id: 'transcript', label: 'Transcript' },
    { id: 'sentiment',  label: 'Sentiment'  },
    { id: 'summary',    label: 'Summary'    },
    { id: 'cli',        label: '🤖 Ask AI'  },
  ]

  return (
    <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--text)', overflow: 'hidden' }}>
      <Nav />

      {/* Floating player popup — positioned via CSS fixed */}
      <FloatingPlayer
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

      {/* Tabs panel — fills the full screen behind the floating player */}
      <div style={{
        flex: '1 1 0', minHeight: 0,
        display: 'flex', flexDirection: 'column',
        margin: '0 clamp(12px, 3vw, 40px) clamp(6px, 1vw, 12px)',
        background: 'var(--surface)', borderRadius: 10,
        border: '1px solid var(--border)', overflow: 'hidden',
      }}>
        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)', flexShrink: 0 }}>
          {TABS.map(t => (
            <button
              key={t.id} type="button" onClick={() => setTab(t.id)}
              style={{
                padding: '8px 14px', fontSize: '0.75rem', fontWeight: 600,
                background: 'none', border: 'none', cursor: 'pointer',
                color:        tab === t.id ? 'var(--accent)' : 'var(--text-muted)',
                borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
                transition: 'color 0.15s', whiteSpace: 'nowrap',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          {tab === 'transcript' && (
            <ModelGate feature="transcribe">
              <TranscriptList segments={store.segments} activeIndex={store.activeSegmentIndex} onSeek={ms => {
                store.setCurrentTimeMs(ms)
                setSubtitle(store.segments.find(s => ms >= s.startMs && ms <= s.endMs)?.text ?? '')
              }} />
            </ModelGate>
          )}
          {tab === 'sentiment' && (
            <ModelGate feature="sentiment">
              <SentimentView sentiment={store.sentiment} totalDurationMs={totalDurMs} />
            </ModelGate>
          )}
          {tab === 'summary' && (
            <ModelGate feature="summary">
              <SummaryView summary={store.summary} />
            </ModelGate>
          )}
          {tab === 'cli' && <CliPanel sessionId={store.sessionId} />}
        </div>
      </div>
    </div>
  )
}
