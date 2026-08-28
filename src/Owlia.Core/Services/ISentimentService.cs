using Owlia.Core.Models;

namespace Owlia.Core.Services;

public interface ISentimentService
{
    Task<SentimentResult?> GetSentimentAsync(string sessionId, CancellationToken ct = default);
}
