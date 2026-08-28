using Owlia.Core.Services;

namespace Owlia.Host.Api;

public static class MediaApi
{
    public static void MapMediaApi(this WebApplication app)
    {
        // POST /api/media/upload  (multipart/form-data, field "file")  → { filePath }
        // Browsers never expose a real filesystem path for a File object — not
        // via <input type=file>, and never via drag-and-drop — so the file's
        // bytes are uploaded and saved server-side; the returned path is what
        // /api/media/analyze expects.
        app.MapPost("/api/media/upload", async (HttpRequest request) =>
        {
            if (!request.HasFormContentType)
                return Results.BadRequest(new { error = "Expected multipart/form-data" });

            var form = await request.ReadFormAsync();
            var file = form.Files.FirstOrDefault();
            if (file is null || file.Length == 0)
                return Results.BadRequest(new { error = "No file provided" });

            var uploadsDir = Path.Combine(AppContext.BaseDirectory, "uploads");
            Directory.CreateDirectory(uploadsDir);

            var safeName = $"{Guid.NewGuid():N}_{Path.GetFileName(file.FileName)}";
            var destPath = Path.Combine(uploadsDir, safeName);

            await using (var dst = File.Create(destPath))
                await file.CopyToAsync(dst);

            return Results.Ok(new { filePath = destPath });
        });

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
