using System.Diagnostics;
using System.Text.Json;
using Microsoft.AspNetCore.SignalR;
using Owlia.Data.Repositories;
using Owlia.Host.Hubs;
using Newtonsoft.Json;

namespace Owlia.Host.Api;

public static class CliApi
{
    // Cache: sessionId → temp file path (written once, reused per query)
    private static readonly Dictionary<string, string> _contextCache = new();
    private static readonly SemaphoreSlim _cacheLock = new(1, 1);

    public static void MapCliApi(this WebApplication app)
    {
        // GET /api/cli/status  → { claude: bool, opencode: bool }
        app.MapGet("/api/cli/status", () =>
        {
            return Results.Ok(new
            {
                claude = Which("claude"),
                opencode = Which("opencode"),
            });
        });

        // POST /api/cli/query  { sessionId, question, cli }  → streams via SignalR CliResponse
        app.MapPost("/api/cli/query", async (
            CliQueryRequest req,
            ISessionRepository repo,
            IHubContext<ProgressHub> hub,
            CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(req.Question))
                return Results.BadRequest(new { error = "question is required" });

            var cliBin = req.Cli switch
            {
                "opencode" => "opencode",
                _ => "claude",
            };

            if (!Which(cliBin))
                return Results.BadRequest(new { error = $"{cliBin} not found in PATH" });

            // Build context file (cached per sessionId)
            var contextFile = await GetOrBuildContextFileAsync(req.SessionId, repo, ct);

            _ = Task.Run(async () =>
            {
                var group = ProgressHub.SessionGroup(req.SessionId);
                try
                {
                    // Build CLI arguments:
                    // Claude CLI: claude --print -p "<question>" [--file <ctx>]
                    // OpenCode CLI: opencode run "<question>" [--context <ctx>]
                    ProcessStartInfo psi;
                    if (req.Cli == "opencode")
                    {
                        var ctxArg = contextFile is not null ? $" --context \"{contextFile}\"" : "";
                        psi = new ProcessStartInfo("opencode", $"run \"{EscapeArg(req.Question)}\"{ctxArg}")
                        {
                            RedirectStandardOutput = true,
                            RedirectStandardError = true,
                            UseShellExecute = false,
                            CreateNoWindow = true,
                        };
                    }
                    else
                    {
                        // claude --print suppresses interactive UI and streams text to stdout
                        var ctxArg = contextFile is not null ? $" --file \"{contextFile}\"" : "";
                        psi = new ProcessStartInfo("claude", $"--print -p \"{EscapeArg(req.Question)}\"{ctxArg}")
                        {
                            RedirectStandardOutput = true,
                            RedirectStandardError = true,
                            UseShellExecute = false,
                            CreateNoWindow = true,
                        };
                    }

                    using var proc = Process.Start(psi)!;

                    // Stream stdout chunks to the frontend
                    var readTask = Task.Run(async () =>
                    {
                        var buf = new char[256];
                        int read;
                        while ((read = await proc.StandardOutput.ReadAsync(buf, 0, buf.Length)) > 0)
                        {
                            var chunk = new string(buf, 0, read);
                            await hub.Clients.Group(group).SendAsync("CliResponse", new { chunk });
                        }
                    });

                    await readTask;
                    await proc.WaitForExitAsync();

                    if (proc.ExitCode != 0)
                    {
                        var stderr = await proc.StandardError.ReadToEndAsync();
                        if (!string.IsNullOrWhiteSpace(stderr))
                            await hub.Clients.Group(group).SendAsync("CliError", new { error = stderr.Trim() });
                    }

                    await hub.Clients.Group(group).SendAsync("CliResponse", new { chunk = (string?)null, done = true });
                }
                catch (Exception ex)
                {
                    await hub.Clients.Group(group).SendAsync("CliError", new { error = ex.Message });
                }
            }, CancellationToken.None);

            return Results.Accepted();
        });
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private static bool Which(string name)
    {
        try
        {
            var psi = new ProcessStartInfo("where", name)
            {
                RedirectStandardOutput = true,
                UseShellExecute = false,
                CreateNoWindow = true,
            };
            using var p = Process.Start(psi)!;
            p.WaitForExit(2000);
            return p.ExitCode == 0;
        }
        catch { return false; }
    }

    private static async Task<string?> GetOrBuildContextFileAsync(
        string sessionId,
        ISessionRepository repo,
        CancellationToken ct)
    {
        await _cacheLock.WaitAsync(ct);
        try
        {
            if (_contextCache.TryGetValue(sessionId, out var cached) && File.Exists(cached))
                return cached;

            var session = await repo.GetByIdAsync(sessionId, ct);
            if (session is null) return null;

            var segments = await repo.GetSegmentsAsync(sessionId, ct);
            var summary = await repo.GetSummaryAsync(sessionId, ct);

            var ctx = new
            {
                session = new
                {
                    id = session.Id,
                    fileName = session.FileName,
                    durationSeconds = session.DurationSeconds,
                    speakerCount = session.SpeakerCount,
                    createdAt = session.CreatedAt,
                },
                transcript = segments.Select(s => new
                {
                    speaker = s.Speaker,
                    startMs = s.StartMs,
                    endMs = s.EndMs,
                    text = s.Text,
                    sentimentScore = s.SentimentScore,
                    sentimentLabel = s.SentimentLabel,
                }),
                summary = summary is null ? null : new
                {
                    summaryText = summary.SummaryText,
                    keywords = JsonConvert.DeserializeObject<List<string>>(summary.KeywordsJson),
                    keyTakeaways = JsonConvert.DeserializeObject<List<string>>(summary.KeyTakeawaysJson),
                },
            };

            var json = JsonConvert.SerializeObject(ctx, Formatting.Indented);
            var tmpPath = Path.Combine(Path.GetTempPath(), $"owlia-ctx-{sessionId}.json");
            await File.WriteAllTextAsync(tmpPath, json, ct);

            _contextCache[sessionId] = tmpPath;
            return tmpPath;
        }
        finally
        {
            _cacheLock.Release();
        }
    }

    private static string EscapeArg(string s) => s.Replace("\"", "\\\"");

    private sealed record CliQueryRequest(string SessionId, string Question, string? Cli);
}
