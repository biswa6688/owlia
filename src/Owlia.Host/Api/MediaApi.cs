using Owlia.Core.Services;

namespace Owlia.Host.Api;

public static class MediaApi
{
    public static void MapMediaApi(this WebApplication app)
    {
        // POST /api/media/analyze  { filePath }  → { sessionId }
        app.MapPost("/api/media/analyze", async (
            AnalyzeRequest req,
            ITranscriptService transcript,
            CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(req.FilePath) || !File.Exists(req.FilePath))
                return Results.BadRequest(new { error = "File not found: " + req.FilePath });

            // AnalyzeAsync kicks off the full pipeline (VAD→ASR→Diarize→Sentiment→Summary)
            // and streams progress over SignalR. Returns the new sessionId.
            var sessionId = await transcript.AnalyzeAsync(req.FilePath, ct);
            return Results.Ok(new { sessionId });
        });
    }

    private sealed record AnalyzeRequest(string FilePath);
}
