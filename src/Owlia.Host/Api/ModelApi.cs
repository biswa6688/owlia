using System.Collections.Concurrent;
using Microsoft.AspNetCore.SignalR;
using Owlia.Core.Services;
using Owlia.Host.Hubs;

namespace Owlia.Host.Api;

public static class ModelApi
{
    // Tracks in-flight downloads so Pause/Cancel can signal the running task.
    // Single-process desktop app — static state here is fine.
    private static readonly ConcurrentDictionary<string, ActiveDownload> _active = new();

    public static void MapModelApi(this WebApplication app)
    {
        // GET /api/models — return status of all known models
        app.MapGet("/api/models", async (IModelManagerService models, CancellationToken ct) =>
        {
            var statuses = await models.GetStatusAsync(ct);
            return Results.Ok(statuses);
        });

        // POST /api/models/download — start (or resume) a download in the background.
        // If a partial ".tmp" file exists for this model, ModelManager resumes it
        // via HTTP Range automatically — no separate "resume" endpoint needed.
        app.MapPost("/api/models/download", (
            DownloadRequest req,
            IModelManagerService models,
            IHubContext<ProgressHub> hub) =>
        {
            if (_active.ContainsKey(req.ModelId))
                return Results.Accepted(); // already downloading — no-op

            var active = new ActiveDownload();
            _active[req.ModelId] = active;

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

                    await models.DownloadAsync(req.ModelId, progress, active.Cts.Token);

                    await hub.Clients.All.SendAsync("ModelDownloadProgress", new
                    {
                        modelId = req.ModelId,
                        percent = 100.0,
                        bytesDownloaded = 0L,
                        totalBytes = 0L,
                        complete = true,
                    });
                }
                catch (OperationCanceledException)
                {
                    if (active.CancelRequested)
                    {
                        await models.CancelDownloadAsync(req.ModelId, CancellationToken.None);
                        await hub.Clients.All.SendAsync("ModelDownloadCancelled", new { modelId = req.ModelId });
                    }
                    else
                    {
                        await hub.Clients.All.SendAsync("ModelDownloadPaused", new { modelId = req.ModelId });
                    }
                }
                catch (Exception ex)
                {
                    await hub.Clients.All.SendAsync("ModelDownloadError", new
                    {
                        modelId = req.ModelId,
                        error = ex.Message,
                    });
                }
                finally
                {
                    _active.TryRemove(req.ModelId, out _);
                }
            }, CancellationToken.None);

            return Results.Accepted();
        });

        // POST /api/models/pause — stop the transfer but keep the partial ".tmp"
        // file so a later POST /api/models/download resumes from where it left off.
        app.MapPost("/api/models/pause", (DownloadRequest req) =>
        {
            if (_active.TryGetValue(req.ModelId, out var active))
                active.Cts.Cancel();
            return Results.Accepted();
        });

        // POST /api/models/cancel — stop the transfer and delete the partial file(s).
        app.MapPost("/api/models/cancel", async (
            DownloadRequest req,
            IModelManagerService models,
            IHubContext<ProgressHub> hub,
            CancellationToken ct) =>
        {
            if (_active.TryGetValue(req.ModelId, out var active))
            {
                // Signal the running task to cancel-and-cleanup itself.
                active.CancelRequested = true;
                active.Cts.Cancel();
            }
            else
            {
                // Nothing actively running (e.g. paused in a previous app session) —
                // clean up directly.
                await models.CancelDownloadAsync(req.ModelId, ct);
                await hub.Clients.All.SendAsync("ModelDownloadCancelled", new { modelId = req.ModelId });
            }
            return Results.Accepted();
        });
    }

    private sealed record DownloadRequest(string ModelId);

    private sealed class ActiveDownload
    {
        public CancellationTokenSource Cts { get; } = new();
        public bool CancelRequested { get; set; }
    }
}
