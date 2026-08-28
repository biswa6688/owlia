using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Owlia.Data;

public class OwliaDbContextFactory : IDesignTimeDbContextFactory<OwliaDbContext>
{
    public OwliaDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<OwliaDbContext>();
        optionsBuilder.UseSqlite("Data Source=../../data/owlia.db");
        return new OwliaDbContext(optionsBuilder.Options);
    }
}
