using Microsoft.EntityFrameworkCore;
using Owlia.Data.Entities;

namespace Owlia.Data;

public class OwliaDbContext : DbContext
{
    public OwliaDbContext(DbContextOptions<OwliaDbContext> options) : base(options)
    {
    }

    public DbSet<SessionEntity> Sessions => Set<SessionEntity>();
    public DbSet<SegmentEntity> Segments => Set<SegmentEntity>();
    public DbSet<SummaryEntity> Summaries => Set<SummaryEntity>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<SessionEntity>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasMany(x => x.Segments)
                .WithOne(x => x.Session)
                .HasForeignKey(x => x.SessionId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Summary)
                .WithOne(x => x.Session)
                .HasForeignKey<SummaryEntity>(x => x.SessionId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<SegmentEntity>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.SessionId);
        });

        modelBuilder.Entity<SummaryEntity>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.SessionId).IsUnique();
        });
    }
}
