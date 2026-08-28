using Microsoft.Extensions.DependencyInjection;
using Newtonsoft.Json;
using Owlia.AI.Audio;
using Owlia.AI.Asr;
using Owlia.AI.Diarization;
using Owlia.AI.Sentiment;
using Owlia.AI.Summary;
using Owlia.AI.Vad;
using Owlia.Core.Models;
using Owlia.Core.Services;
using Owlia.Data.Entities;
using Owlia.Data.Repositories;

namespace Owlia.AI;

/// <summary>
/// Orchestrates the full AI pipeline: VAD → ASR → Diarization → Sentiment → Summary.
/// Streams progress via IPipelineNotifier (backed by SignalR in the host).
/// The pipeline runs on a background thread with its own DI scope so that the
/// scoped DbContext is not disposed when the originating HTTP request ends.
/// </summary>
public sealed class TranscriptService : ITranscriptService
{
    private readonly IModelManagerService _models;
    private readonly ISessionRepository _repo;
    private readonly IPipelineNotifier _notifier;
    private readonly IServiceScopeFactory _scopeFactory;

    public TranscriptService(
        IModelManagerService models,
        ISessionRepository repo,
        IPipelineNotifier notifier,
        IServiceScopeFactory scopeFactory)
    {
        _models = models;
        _repo = repo;
        _notifier = notifier;
        _scopeFactory = scopeFactory;
    }

    // ── ITranscriptService ────────────────────────────────────────────────

    public Task<string> AnalyzeAsync(string filePath, CancellationToken ct = default)
    {
        var sessionId = Guid.NewGuid().ToString("N");

        // Run on a background thread with its own DI scope so the DbContext
        // is not disposed when the originating HTTP request scope ends.
        _ = Task.Run(async () =>
        {
            await using var scope = _scopeFactory.CreateAsyncScope();
            var repo = scope.ServiceProvider.GetRequiredService<ISessionRepository>();
            try
            {
                await RunPipelineAsync(filePath, sessionId, repo, CancellationToken.None);
            }
            catch (Exception ex)
            {
                await _notifier.ErrorAsync(sessionId, ex.Message);
            }
        }, CancellationToken.None);

        return Task.FromResult(sessionId);
    }

    public async Task<TranscriptResult?> GetTranscriptAsync(string sessionId, CancellationToken ct = default)
    {
        var session = await _repo.GetByIdAsync(sessionId, ct);
        if (session is null) return null;

        var segments = await _repo.GetSegmentsAsync(sessionId, ct);

        return new TranscriptResult
        {
            SessionId = sessionId,
            Segments = segments.Select(MapSegment).ToList(),
        };
    }

    // ── Full Pipeline ─────────────────────────────────────────────────────

    private async Task RunPipelineAsync(string filePath, string sessionId, ISessionRepository repo, CancellationToken ct)
    {
        // ── 1. Persist session record ──────────────────────────────────────
        var fileName = Path.GetFileName(filePath);
        var session = new SessionEntity
        {
            Id = sessionId,
            FileName = fileName,
            FilePath = filePath,
            DurationSeconds = 0,
            SpeakerCount = 0,
            CreatedAt = DateTime.UtcNow,
        };
        await repo.AddAsync(session, ct);

        // ── 2. Load audio ──────────────────────────────────────────────────
        await _notifier.ProgressAsync(sessionId, "audio", 5);
        var audio = await AudioHelper.LoadPcmAsync(filePath, ct);
        double totalSec = (double)audio.Length / 16000;

        // ── 3. Voice Activity Detection ───────────────────────────────────
        await _notifier.ProgressAsync(sessionId, "vad", 10);
        List<VadSegment> vadSegments;
        var vadPath = _models.GetModelPath("silero-vad");
        if (File.Exists(vadPath))
        {
            using var vad = new SileroVadRunner(vadPath);
            vadSegments = vad.Run(audio);
        }
        else
        {
            vadSegments = new List<VadSegment> { new() { StartSec = 0, EndSec = totalSec } };
        }

        // ── 4. ASR (Whisper) ──────────────────────────────────────────────
        await _notifier.ProgressAsync(sessionId, "asr", 20);
        List<WhisperSegment> whisperSegments;
        var whisperPath = _models.GetModelPath("whisper-large-v3");
        if (File.Exists(whisperPath))
        {
            using var whisper = new WhisperRunner(whisperPath);
            whisperSegments = whisper.Transcribe(audio, vadSegments);
        }
        else
        {
            whisperSegments = vadSegments.Select(v => new WhisperSegment
            {
                StartSec = v.StartSec,
                EndSec = v.EndSec,
                Text = "[ASR model not downloaded — visit Download page]",
            }).ToList();
        }
        await _notifier.ProgressAsync(sessionId, "asr", 50);

        // ── 5. Diarization ────────────────────────────────────────────────
        await _notifier.ProgressAsync(sessionId, "diarization", 55);
        var speakerLabels = new string[whisperSegments.Count];
        var pyPath = _models.GetModelPath("pyannote-seg");
        var wePath = _models.GetModelPath("wespeaker-ecapa");

        if (File.Exists(pyPath) && File.Exists(wePath) && whisperSegments.Count > 0)
        {
            using var embRunner = new EmbeddingRunner(wePath);
            var embeddings = new float[whisperSegments.Count][];
            for (int i = 0; i < whisperSegments.Count; i++)
            {
                int startSample = (int)(whisperSegments[i].StartSec * 16000);
                int endSample = Math.Min((int)(whisperSegments[i].EndSec * 16000), audio.Length);
                var chunk = audio.AsSpan(startSample, Math.Max(1, endSample - startSample)).ToArray();
                embeddings[i] = embRunner.GetEmbedding(chunk);
            }
            speakerLabels = SpeakerClusterer.Cluster(embeddings);
        }
        else
        {
            for (int i = 0; i < whisperSegments.Count; i++)
                speakerLabels[i] = "Speaker 0";
        }

        // ── 6. Sentiment ──────────────────────────────────────────────────
        await _notifier.ProgressAsync(sessionId, "sentiment", 65);
        var sentimentResults = new (double Score, string Label)[whisperSegments.Count];
        var sentimentPath = _models.GetModelPath("roberta-sentiment");
        if (File.Exists(sentimentPath))
        {
            using var sentiment = new SentimentRunner(sentimentPath);
            for (int i = 0; i < whisperSegments.Count; i++)
                sentimentResults[i] = sentiment.Analyze(whisperSegments[i].Text);
        }
        else
        {
            for (int i = 0; i < whisperSegments.Count; i++)
                sentimentResults[i] = (50, "Neutral");
        }

        // ── 7. Build + persist segments, stream each to clients ───────────
        await _notifier.ProgressAsync(sessionId, "saving", 75);
        var entities = new List<SegmentEntity>();
        var speakerSet = new HashSet<string>();

        for (int i = 0; i < whisperSegments.Count; i++)
        {
            var ws = whisperSegments[i];
            var seg = new SegmentEntity
            {
                Id = Guid.NewGuid().ToString("N"),
                SessionId = sessionId,
                Speaker = speakerLabels[i],
                StartMs = (long)(ws.StartSec * 1000),
                EndMs = (long)(ws.EndSec * 1000),
                Text = ws.Text,
                SentimentScore = sentimentResults[i].Score,
                SentimentLabel = sentimentResults[i].Label,
                Confidence = 0.95,
            };
            entities.Add(seg);
            speakerSet.Add(seg.Speaker);

            await _notifier.SegmentAsync(sessionId, MapSegment(seg));
        }

        await repo.AddSegmentsAsync(entities, ct);

        // ── 8. Summarization ──────────────────────────────────────────────
        await _notifier.ProgressAsync(sessionId, "summary", 80);
        var fullText = string.Join(" ", whisperSegments.Select(w => w.Text));
        var bartPath = _models.GetModelPath("bart-cnn");

        SummaryEntity summaryEntity;
        if (File.Exists(bartPath) && !string.IsNullOrWhiteSpace(fullText))
        {
            using var summaryRunner = new SummaryRunner(bartPath);
            var (summaryText, keywords, takeaways) = summaryRunner.Summarize(fullText);
            summaryEntity = new SummaryEntity
            {
                Id = Guid.NewGuid().ToString("N"),
                SessionId = sessionId,
                SummaryText = summaryText,
                KeywordsJson = JsonConvert.SerializeObject(keywords),
                KeyTakeawaysJson = JsonConvert.SerializeObject(takeaways),
                CreatedAt = DateTime.UtcNow,
            };
        }
        else
        {
            var keywords = SummaryRunner.ExtractKeywordsStatic(fullText, 10);
            summaryEntity = new SummaryEntity
            {
                Id = Guid.NewGuid().ToString("N"),
                SessionId = sessionId,
                SummaryText = fullText.Length > 500 ? fullText[..500] + "…" : fullText,
                KeywordsJson = JsonConvert.SerializeObject(keywords),
                KeyTakeawaysJson = JsonConvert.SerializeObject(new List<string>()),
                CreatedAt = DateTime.UtcNow,
            };
        }
        await repo.UpsertSummaryAsync(summaryEntity, ct);

        // ── 9. Update session metadata ────────────────────────────────────
        var savedSession = await repo.GetByIdAsync(sessionId, ct);
        if (savedSession is not null)
        {
            savedSession.DurationSeconds = totalSec;
            savedSession.SpeakerCount = speakerSet.Count;
            await repo.UpdateAsync(savedSession, ct);
        }

        // ── 10. Done ──────────────────────────────────────────────────────
        await _notifier.ProgressAsync(sessionId, "done", 100);
        await _notifier.CompleteAsync(sessionId);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private static SpeakerSegment MapSegment(SegmentEntity e) => new()
    {
        Id = e.Id,
        SessionId = e.SessionId,
        Speaker = e.Speaker,
        StartMs = e.StartMs,
        EndMs = e.EndMs,
        Text = e.Text,
        Confidence = e.Confidence,
        SentimentScore = e.SentimentScore,
        SentimentLabel = e.SentimentLabel,
    };
}
