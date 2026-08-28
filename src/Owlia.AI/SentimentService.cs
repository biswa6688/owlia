using Newtonsoft.Json;
using Owlia.AI.Sentiment;
using Owlia.Core.Models;
using Owlia.Core.Services;
using Owlia.Data.Repositories;

namespace Owlia.AI;

public sealed class SentimentService : ISentimentService
{
    private readonly ISessionRepository _repo;
    private readonly IModelManagerService _models;

    public SentimentService(ISessionRepository repo, IModelManagerService models)
    {
        _repo = repo;
        _models = models;
    }

    public async Task<SentimentResult?> GetSentimentAsync(string sessionId, CancellationToken ct = default)
    {
        var segments = await _repo.GetSegmentsAsync(sessionId, ct);
        if (segments.Count == 0) return null;

        // Group by speaker → calculate average sentiment score
        var bySpeaker = segments
            .GroupBy(s => s.Speaker)
            .Select(g =>
            {
                double avg = g.Average(s => s.SentimentScore);
                string label = avg < 40 ? "Negative" : avg < 60 ? "Neutral" : "Positive";
                return new SpeakerSentiment
                {
                    Speaker = g.Key,
                    OverallScore = Math.Round(avg, 1),
                    OverallLabel = label,
                };
            })
            .OrderBy(s => s.Speaker)
            .ToList();

        var timeline = segments.Select(s => new SpeakerSegment
        {
            Id = s.Id,
            SessionId = s.SessionId,
            Speaker = s.Speaker,
            StartMs = s.StartMs,
            EndMs = s.EndMs,
            Text = s.Text,
            Confidence = s.Confidence,
            SentimentScore = s.SentimentScore,
            SentimentLabel = s.SentimentLabel,
        }).ToList();

        return new SentimentResult
        {
            SessionId = sessionId,
            BySpeaker = bySpeaker,
            Timeline = timeline,
        };
    }
}
