using Owlia.Data.Repositories;

namespace Owlia.Host.Api;

public static class HistoryApi
{
    public static void MapHistoryApi(this WebApplication app)
    {
        // GET /api/history  → Session[]
        app.MapGet("/api/history", async (
            ISessionRepository repo,
            CancellationToken ct) =>
        {
            var sessions = await repo.GetAllAsync(ct);
            return Results.Ok(sessions.Select(s => new
            {
                s.Id,
                s.FileName,
                s.FilePath,
                s.DurationSeconds,
                s.SpeakerCount,
                s.CreatedAt,
            }));
        });

        // DELETE /api/history/{sessionId}
        app.MapDelete("/api/history/{sessionId}", async (
            string sessionId,
            ISessionRepository repo,
            CancellationToken ct) =>
        {
            await repo.DeleteAsync(sessionId, ct);
            return Results.NoContent();
        });
    }
}
