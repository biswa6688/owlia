using Newtonsoft.Json;
using Owlia.Core.Models;
using Owlia.Core.Services;
using Owlia.Data.Repositories;

namespace Owlia.AI;

public sealed class SummaryService : ISummaryService
{
    private readonly ISessionRepository _repo;

    public SummaryService(ISessionRepository repo)
    {
        _repo = repo;
    }

    public async Task<SummaryResult?> GetSummaryAsync(string sessionId, CancellationToken ct = default)
    {
        var entity = await _repo.GetSummaryAsync(sessionId, ct);
        if (entity is null) return null;

        return new SummaryResult
        {
            SessionId = sessionId,
            Summary = entity.SummaryText,
            Keywords = JsonConvert.DeserializeObject<List<string>>(entity.KeywordsJson) ?? new(),
            KeyTakeaways = JsonConvert.DeserializeObject<List<string>>(entity.KeyTakeawaysJson) ?? new(),
        };
    }
}
