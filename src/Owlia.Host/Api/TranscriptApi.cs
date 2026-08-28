using Owlia.Core.Services;

namespace Owlia.Host.Api;

public static class TranscriptApi
{
    public static void MapTranscriptApi(this WebApplication app)
    {
        // GET /api/transcript/{sessionId}
        app.MapGet("/api/transcript/{sessionId}", async (
            string sessionId,
            ITranscriptService transcript,
            CancellationToken ct) =>
        {
            var result = await transcript.GetTranscriptAsync(sessionId, ct);
            return result is null ? Results.NotFound() : Results.Ok(result);
        });

        // GET /api/sentiment/{sessionId}
        app.MapGet("/api/sentiment/{sessionId}", async (
            string sessionId,
            ISentimentService sentiment,
            CancellationToken ct) =>
        {
            var result = await sentiment.GetSentimentAsync(sessionId, ct);
            return result is null ? Results.NotFound() : Results.Ok(result);
        });

        // GET /api/summary/{sessionId}
        app.MapGet("/api/summary/{sessionId}", async (
            string sessionId,
            ISummaryService summary,
            CancellationToken ct) =>
        {
            var result = await summary.GetSummaryAsync(sessionId, ct);
            return result is null ? Results.NotFound() : Results.Ok(result);
        });
    }
}
