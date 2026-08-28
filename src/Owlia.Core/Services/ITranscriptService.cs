using Owlia.Core.Models;

namespace Owlia.Core.Services;

public interface ITranscriptService
{
    Task<string> AnalyzeAsync(string filePath, CancellationToken ct = default);
    Task<TranscriptResult?> GetTranscriptAsync(string sessionId, CancellationToken ct = default);
}
