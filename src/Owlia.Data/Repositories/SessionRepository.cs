using Microsoft.EntityFrameworkCore;
using Owlia.Data.Entities;

namespace Owlia.Data.Repositories;

public class SessionRepository : ISessionRepository
{
    private readonly OwliaDbContext _db;

    public SessionRepository(OwliaDbContext db)
    {
        _db = db;
    }

    public Task<SessionEntity?> GetByIdAsync(string id, CancellationToken ct = default) =>
        _db.Sessions.FirstOrDefaultAsync(x => x.Id == id, ct);

    public Task<List<SessionEntity>> GetAllAsync(CancellationToken ct = default) =>
        _db.Sessions.OrderByDescending(x => x.CreatedAt).ToListAsync(ct);

    public async Task AddAsync(SessionEntity session, CancellationToken ct = default)
    {
        _db.Sessions.Add(session);
        await _db.SaveChangesAsync(ct);
    }

    public async Task UpdateAsync(SessionEntity session, CancellationToken ct = default)
    {
        _db.Sessions.Update(session);
        await _db.SaveChangesAsync(ct);
    }

    public async Task DeleteAsync(string id, CancellationToken ct = default)
    {
        var entity = await _db.Sessions.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return;
        _db.Sessions.Remove(entity);
        await _db.SaveChangesAsync(ct);
    }

    public async Task AddSegmentsAsync(IEnumerable<SegmentEntity> segments, CancellationToken ct = default)
    {
        _db.Segments.AddRange(segments);
        await _db.SaveChangesAsync(ct);
    }

    public Task<List<SegmentEntity>> GetSegmentsAsync(string sessionId, CancellationToken ct = default) =>
        _db.Segments.Where(x => x.SessionId == sessionId).OrderBy(x => x.StartMs).ToListAsync(ct);

    public async Task UpsertSummaryAsync(SummaryEntity summary, CancellationToken ct = default)
    {
        var existing = await _db.Summaries.FirstOrDefaultAsync(x => x.SessionId == summary.SessionId, ct);
        if (existing is null)
        {
            _db.Summaries.Add(summary);
        }
        else
        {
            existing.SummaryText = summary.SummaryText;
            existing.KeywordsJson = summary.KeywordsJson;
            existing.KeyTakeawaysJson = summary.KeyTakeawaysJson;
            existing.CreatedAt = summary.CreatedAt;
        }
        await _db.SaveChangesAsync(ct);
    }

    public Task<SummaryEntity?> GetSummaryAsync(string sessionId, CancellationToken ct = default) =>
        _db.Summaries.FirstOrDefaultAsync(x => x.SessionId == sessionId, ct);
}
