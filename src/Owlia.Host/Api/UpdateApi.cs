using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.RegularExpressions;
using Owlia.Core.Services;

namespace Owlia.Host.Api;

/// <summary>
/// Manual "is a newer version available" check for CLIs and models. Never
/// downloads or installs anything itself — purely informational, per the
/// user's explicit "no auto updates" requirement. The caller (Download page)
/// decides whether/when to invoke this; it never runs on a timer.
/// </summary>
public static class UpdateApi
{
    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(6) };

    public static void MapUpdateApi(this WebApplication app)
    {
        app.MapGet("/api/updates/check", async (IModelManagerService models, CancellationToken ct) =>
        {
            var cliTask = CheckClisAsync(ct);
            var modelsTask = CheckModelsAsync(models, ct);
            await Task.WhenAll(cliTask, modelsTask);

            return Results.Ok(new { cli = cliTask.Result, models = modelsTask.Result });
        });
    }

    // ── CLI update check (npm registry "latest" dist-tag) ───────────────────

    private static readonly (string Slug, string NpmPackage, string BinName)[] Clis =
    [
        ("claude", "@anthropic-ai/claude-code", "claude"),
        ("opencode", "opencode", "opencode"),
    ];

    private static async Task<List<object>> CheckClisAsync(CancellationToken ct)
    {
        var results = new List<object>();
        foreach (var (slug, npmPackage, binName) in Clis)
        {
            var installed = GetInstalledVersion(binName);
            string? latest = null;
            try
            {
                var url = $"https://registry.npmjs.org/{Uri.EscapeDataString(npmPackage).Replace("%40", "@")}/latest";
                using var res = await Http.GetAsync(url, ct);
                if (res.IsSuccessStatusCode)
                {
                    using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync(ct));
                    if (doc.RootElement.TryGetProperty("version", out var v))
                        latest = v.GetString();
                }
            }
            catch { /* offline or registry unreachable — leave latest null */ }

            var updateAvailable = installed is not null && latest is not null && installed != latest;
            results.Add(new { slug, installedVersion = installed, latestVersion = latest, updateAvailable });
        }
        return results;
    }

    private static string? GetInstalledVersion(string binName)
    {
        try
        {
            var psi = new System.Diagnostics.ProcessStartInfo(binName, "--version")
            {
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true,
            };
            using var p = System.Diagnostics.Process.Start(psi)!;
            p.WaitForExit(3000);
            if (p.ExitCode != 0) return null;
            var output = p.StandardOutput.ReadToEnd().Trim();
            var match = Regex.Match(output, @"\d+\.\d+\.\d+");
            return match.Success ? match.Value : null;
        }
        catch { return null; }
    }

    // ── Model update check (remote Content-Length vs. what we recorded) ────

    private static async Task<List<object>> CheckModelsAsync(IModelManagerService models, CancellationToken ct)
    {
        var statuses = await models.GetStatusAsync(ct);
        var results = new List<object>();

        foreach (var status in statuses)
        {
            if (!status.Downloaded)
            {
                results.Add(new { id = status.Id, updateAvailable = false, @checked = false });
                continue;
            }

            bool? changed = null;
            try
            {
                using var req = new HttpRequestMessage(HttpMethod.Head, status.Url);
                using var res = await Http.SendAsync(req, ct);
                if (res.IsSuccessStatusCode && res.Content.Headers.ContentLength is long len)
                    changed = len != status.SizeBytes;
            }
            catch { /* offline, or a multi-file model with no single Url — leave unknown */ }

            results.Add(new { id = status.Id, updateAvailable = changed ?? false, @checked = changed is not null });
        }
        return results;
    }
}
