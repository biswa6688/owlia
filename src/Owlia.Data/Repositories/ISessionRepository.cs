using Owlia.Data.Entities;

namespace Owlia.Data.Repositories;

public interface ISessionRepository
{
    Task<SessionEntity?> GetByIdAsync(string id, CancellationToken ct = default);
    Task<List<SessionEntity>> GetAllAsync(CancellationToken ct = default);
    Task AddAsync(SessionEntity session, CancellationToken ct = default);
    Task DeleteAsync(string id, CancellationToken ct = default);
    Task AddSegmentsAsync(IEnumerable<SegmentEntity> segments, CancellationToken ct = default);
    Task<List<SegmentEntity>> GetSegmentsAsync(string sessionId, CancellationToken ct = default);
    Task UpsertSummaryAsync(SummaryEntity summary, CancellationToken ct = default);
    Task<SummaryEntity?> GetSummaryAsync(string sessionId, CancellationToken ct = default);
}
