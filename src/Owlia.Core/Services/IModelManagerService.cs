using Owlia.Core.Models;

namespace Owlia.Core.Services;

public interface IModelManagerService
{
    Task<List<ModelStatus>> GetStatusAsync(CancellationToken ct = default);
    Task DownloadAsync(string modelId, IProgress<(long bytesDownloaded, long totalBytes)> progress, CancellationToken ct = default);
    string GetModelPath(string modelId);
}
