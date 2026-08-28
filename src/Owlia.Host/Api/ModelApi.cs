using Microsoft.AspNetCore.SignalR;
using Owlia.Core.Services;
using Owlia.Host.Hubs;

namespace Owlia.Host.Api;

public static class ModelApi
{
    public static void MapModelApi(this WebApplication app)
    {
        // GET /api/models — return status of all known models
        app.MapGet("/api/models", async (IModelManagerService models, CancellationToken ct) =>
        {
            var statuses = await models.GetStatusAsync(ct);
            return Results.Ok(statuses);
        });

        // POST /api/models/download — start download in background, emit SignalR progress
        app.MapPost("/api/models/download", async (
            DownloadRequest req,
            IModelManagerService models,
            IHubContext<ProgressHub> hub,
            CancellationToken ct) =>
        {
            _ = Task.Run(async () =>
            {
                try
                {
                    var progress = new Progress<(long downloaded, long total)>(async p =>
                    {
                        var percent = p.total > 0 ? (double)p.downloaded / p.total * 100 : 0;
                        await hub.Clients.All.SendAsync("ModelDownloadProgress", new
                        {
                            modelId = req.ModelId,
                            percent = Math.Round(percent, 1),
                            bytesDownloaded = p.downloaded,
                            totalBytes = p.total,
                        });
                    });

                    await models.DownloadAsync(req.ModelId, progress, CancellationToken.None);

                    await hub.Clients.All.SendAsync("ModelDownloadProgress", new
                    {
                        modelId = req.ModelId,
                        percent = 100.0,
                        bytesDownloaded = 0L,
                        totalBytes = 0L,
                        complete = true,
                    });
                }
                catch (Exception ex)
                {
                    await hub.Clients.All.SendAsync("ModelDownloadError", new
                    {
                        modelId = req.ModelId,
                        error = ex.Message,
                    });
                }
            }, CancellationToken.None);

            return Results.Accepted();
        });
    }

    private sealed record DownloadRequest(string ModelId);
}
