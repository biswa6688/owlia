using Owlia.Core.Models;

namespace Owlia.Core.Services;

public interface IModelManagerService
{
    Task<List<ModelStatus>> GetStatusAsync(CancellationToken ct = default);
    Task DownloadAsync(string modelId, IProgress<(long bytesDownloaded, long totalBytes)> progress, CancellationToken ct = default);

    /// <summary>Deletes a model's in-progress ".tmp" file(s) — used when a paused download is cancelled outright rather than resumed.</summary>
    Task CancelDownloadAsync(string modelId, CancellationToken ct = default);

    /// <summary>Path to a model's single file. For multi-file models (e.g. encoder+decoder), returns the first file — use <see cref="GetModelPaths"/> instead.</summary>
    string GetModelPath(string modelId);

    /// <summary>All file paths for a model, in manifest order.</summary>
    List<string> GetModelPaths(string modelId);
}
