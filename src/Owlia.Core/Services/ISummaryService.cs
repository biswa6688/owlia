using Owlia.Core.Models;

namespace Owlia.Core.Services;

public interface ISummaryService
{
    Task<SummaryResult?> GetSummaryAsync(string sessionId, CancellationToken ct = default);
}
