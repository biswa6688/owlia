using System.Security.Cryptography;
using System.Text.Json;
using Owlia.Core.Models;
using Owlia.Core.Services;

namespace Owlia.AI;

public sealed class ModelManager : IModelManagerService
{
    private readonly string _modelsDir;
    private readonly string _manifestPath;
    private List<ModelManifestEntry>? _manifest;
    private readonly SemaphoreSlim _lock = new(1, 1);

    public ModelManager(IServiceProvider sp)
    {
        _ = sp; // unused — kept for future extensibility
        // Models dir is next to the exe (AppContext.BaseDirectory).
        _modelsDir = Path.Combine(AppContext.BaseDirectory, "models");
        Directory.CreateDirectory(_modelsDir);
        _manifestPath = Path.Combine(AppContext.BaseDirectory, "models", "models.json");

        // Fallback: walk up the directory tree looking for models/models.json (dev convenience).
        // In dev: BaseDirectory = …/src/Owlia.Host/bin/Debug/net10.0/ → 5 levels up = repo root.
        if (!File.Exists(_manifestPath))
        {
            var dir = new DirectoryInfo(AppContext.BaseDirectory);
            for (int i = 0; i < 6 && dir is not null; i++)
            {
                var candidate = Path.Combine(dir.FullName, "models", "models.json");
                if (File.Exists(candidate))
                {
                    _manifestPath = candidate;
                    // Also use the repo models/ dir for storing downloads in dev
                    _modelsDir = Path.Combine(dir.FullName, "models");
                    break;
                }
                dir = dir.Parent;
            }
        }
    }

    // ── Public API ──────────────────────────────────────────────────────────

    public async Task<List<ModelStatus>> GetStatusAsync(CancellationToken ct = default)
    {
        var manifest = await LoadManifestAsync(ct);
        var result = new List<ModelStatus>();
        foreach (var entry in manifest)
        {
            var fileStates = entry.Files.Select(f =>
            {
                var path = Path.Combine(_modelsDir, f.FileName);
                var exists = File.Exists(path);
                return (exists, verified: exists && VerifyHash(path, f.Sha256));
            }).ToList();

            result.Add(new ModelStatus
            {
                Id = entry.Id,
                DisplayName = string.IsNullOrEmpty(entry.DisplayName) ? entry.Id : entry.DisplayName,
                FileName = entry.Files.Count == 1 ? entry.Files[0].FileName : $"{entry.Id} ({entry.Files.Count} files)",
                Feature = entry.Feature,
                SizeBytes = entry.Files.Sum(f => f.SizeBytes),
                Sha256 = entry.Files.Count == 1 ? entry.Files[0].Sha256 : string.Empty,
                Url = entry.Files.Count == 1 ? entry.Files[0].Url : string.Empty,
                Downloaded = fileStates.All(s => s.exists),
                Verified = fileStates.All(s => s.verified),
            });
        }
        return result;
    }

    public async Task DownloadAsync(
        string modelId,
        IProgress<(long bytesDownloaded, long totalBytes)> progress,
        CancellationToken ct = default)
    {
        var manifest = await LoadManifestAsync(ct);
        var entry = manifest.FirstOrDefault(m => m.Id == modelId)
            ?? throw new ArgumentException($"Unknown model id: {modelId}");

        var totalBytes = entry.Files.Sum(f => f.SizeBytes);
        long bytesDoneBeforeCurrentFile = 0;

        using var http = new HttpClient();
        http.Timeout = Timeout.InfiniteTimeSpan;

        foreach (var file in entry.Files)
        {
            var destPath = Path.Combine(_modelsDir, file.FileName);
            var destDir = Path.GetDirectoryName(destPath);
            if (!string.IsNullOrEmpty(destDir)) Directory.CreateDirectory(destDir);
            var tmpPath = destPath + ".tmp";

            using (var response = await http.GetAsync(file.Url, HttpCompletionOption.ResponseHeadersRead, ct))
            {
                response.EnsureSuccessStatusCode();

                await using var src = await response.Content.ReadAsStreamAsync(ct);
                await using var dst = File.Create(tmpPath);

                var buffer = new byte[81920];
                int read;
                long fileDownloaded = 0;

                while ((read = await src.ReadAsync(buffer, ct)) > 0)
                {
                    await dst.WriteAsync(buffer.AsMemory(0, read), ct);
                    fileDownloaded += read;
                    progress.Report((bytesDoneBeforeCurrentFile + fileDownloaded, totalBytes));
                }

                await dst.FlushAsync(ct);
            }

            // SHA256 validation (skip if sha256 field is empty — manifest placeholder).
            if (!string.IsNullOrEmpty(file.Sha256) && !VerifyHash(tmpPath, file.Sha256))
            {
                File.Delete(tmpPath);
                throw new InvalidDataException($"SHA256 mismatch for {file.FileName}");
            }

            File.Move(tmpPath, destPath, overwrite: true);
            bytesDoneBeforeCurrentFile += file.SizeBytes;
        }
    }

    public string GetModelPath(string modelId) => GetModelPaths(modelId).First();

    public List<string> GetModelPaths(string modelId)
    {
        // Synchronous — just return the expected paths; caller checks File.Exists.
        var manifest = LoadManifestAsync(CancellationToken.None).GetAwaiter().GetResult();
        var entry = manifest.FirstOrDefault(m => m.Id == modelId)
            ?? throw new ArgumentException($"Unknown model id: {modelId}");
        return entry.Files.Select(f => Path.Combine(_modelsDir, f.FileName)).ToList();
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private async Task<List<ModelManifestEntry>> LoadManifestAsync(CancellationToken ct)
    {
        if (_manifest is not null) return _manifest;
        await _lock.WaitAsync(ct);
        try
        {
            if (_manifest is not null) return _manifest;
            if (!File.Exists(_manifestPath))
                return _manifest = new List<ModelManifestEntry>();

            var json = await File.ReadAllTextAsync(_manifestPath, ct);
            _manifest = JsonSerializer.Deserialize<List<ModelManifestEntry>>(json,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
                ?? new List<ModelManifestEntry>();
            return _manifest;
        }
        finally
        {
            _lock.Release();
        }
    }

    private static bool VerifyHash(string filePath, string expectedHex)
    {
        if (string.IsNullOrEmpty(expectedHex)) return true; // no hash to check
        using var sha = SHA256.Create();
        using var fs = File.OpenRead(filePath);
        var hash = sha.ComputeHash(fs);
        var actual = Convert.ToHexString(hash);
        return string.Equals(actual, expectedHex, StringComparison.OrdinalIgnoreCase);
    }

    // ── Manifest DTOs ────────────────────────────────────────────────────────

    private sealed class ModelManifestEntry
    {
        public string Id { get; set; } = string.Empty;
        public string DisplayName { get; set; } = string.Empty;
        public string Feature { get; set; } = string.Empty;
        public List<ModelFileEntry> Files { get; set; } = new();
    }

    private sealed class ModelFileEntry
    {
        public string FileName { get; set; } = string.Empty;
        public long SizeBytes { get; set; }
        public string Sha256 { get; set; } = string.Empty;
        public string Url { get; set; } = string.Empty;
    }
}
