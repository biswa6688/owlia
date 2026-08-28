using System.Reflection;
using log4net;
using log4net.Config;
using Microsoft.EntityFrameworkCore;
using Owlia.Data;
using Owlia.Data.Repositories;
using Photino.NET;

var logRepository = LogManager.GetRepository(Assembly.GetExecutingAssembly());
XmlConfigurator.Configure(logRepository, new FileInfo(Path.Combine(AppContext.BaseDirectory, "log4net.config")));
var log = LogManager.GetLogger(typeof(Program));

var dataDir = Path.Combine(AppContext.BaseDirectory, "data");
Directory.CreateDirectory(dataDir);
var dbPath = Path.Combine(dataDir, "owlia.db");

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseUrls("http://127.0.0.1:0");

builder.Services.AddDbContext<OwliaDbContext>(options => options.UseSqlite($"Data Source={dbPath}"));
builder.Services.AddScoped<ISessionRepository, SessionRepository>();
builder.Services.AddSignalR();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<OwliaDbContext>();
    db.Database.Migrate();
    log.Info("Database migrated: " + dbPath);
}

app.UseDefaultFiles();
app.UseStaticFiles();

app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }));

var runTask = app.RunAsync();

var server = app.Services.GetRequiredService<Microsoft.AspNetCore.Hosting.Server.IServer>();
var addressFeature = server.Features.Get<Microsoft.AspNetCore.Hosting.Server.Features.IServerAddressesFeature>();
var url = addressFeature!.Addresses.First();
log.Info("Kestrel listening at " + url);

var window = new PhotinoWindow()
    .SetTitle("OWLIA — Offline Voice & Language Intelligence Analytics")
    .SetUseOsDefaultSize(false)
    .SetSize(new System.Drawing.Size(1440, 900))
    .Center()
    .SetResizable(true)
    .Load(url);

window.WaitForClose();

log.Info("Window closed, shutting down host.");
await app.StopAsync();
