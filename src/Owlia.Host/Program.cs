using System.Reflection;
using log4net;
using log4net.Config;
using Microsoft.EntityFrameworkCore;
using Owlia.AI;
using Owlia.Core.Services;
using Owlia.Data;
using Owlia.Data.Repositories;
using Owlia.Host.Api;
using Owlia.Host.Hubs;
using Photino.NET;

// ── Logging ───────────────────────────────────────────────────────────────────
var logRepository = LogManager.GetRepository(Assembly.GetExecutingAssembly());
XmlConfigurator.Configure(logRepository,
    new FileInfo(Path.Combine(AppContext.BaseDirectory, "log4net.config")));
var log = LogManager.GetLogger(typeof(Program));

// ── Paths ─────────────────────────────────────────────────────────────────────
var dataDir = Path.Combine(AppContext.BaseDirectory, "data");
Directory.CreateDirectory(dataDir);
var dbPath = Path.Combine(dataDir, "owlia.db");

// ── Web Application Builder ───────────────────────────────────────────────────
var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseUrls("http://127.0.0.1:0");

// Data
builder.Services.AddDbContext<OwliaDbContext>(options =>
    options.UseSqlite($"Data Source={dbPath}"));
builder.Services.AddScoped<ISessionRepository, SessionRepository>();

// AI services
builder.Services.AddSingleton<IModelManagerService, ModelManager>();
builder.Services.AddScoped<ITranscriptService, TranscriptService>();
builder.Services.AddScoped<ISentimentService, SentimentService>();
builder.Services.AddScoped<ISummaryService, SummaryService>();
builder.Services.AddScoped<ITtsService, TtsService>();

// SignalR + notifier
builder.Services.AddSignalR();
builder.Services.AddSingleton<IPipelineNotifier, SignalRPipelineNotifier>();

// ── Build ─────────────────────────────────────────────────────────────────────
var app = builder.Build();

// ── Migrate DB ────────────────────────────────────────────────────────────────
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<OwliaDbContext>();
    db.Database.Migrate();
    log.Info("Database migrated: " + dbPath);
}

// ── Middleware ────────────────────────────────────────────────────────────────
app.UseDefaultFiles();
app.UseStaticFiles();

// ── API Routes ────────────────────────────────────────────────────────────────
app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }));
app.MapModelApi();
app.MapMediaApi();
app.MapTranscriptApi();
app.MapHistoryApi();
app.MapTtsApi();
app.MapCliApi();

// ── SignalR Hub ───────────────────────────────────────────────────────────────
app.MapHub<ProgressHub>("/hub/progress");

// ── SPA fallback — serve index.html for all non-API, non-file routes ─────────
// This is required for React Router's BrowserRouter to handle client-side routes
// like /landing, /history, /download, /playground without a 404.
app.MapFallbackToFile("index.html");

// ── Start Kestrel ─────────────────────────────────────────────────────────────
var runTask = app.RunAsync();

var server = app.Services.GetRequiredService<Microsoft.AspNetCore.Hosting.Server.IServer>();
var addressFeature = server.Features
    .Get<Microsoft.AspNetCore.Hosting.Server.Features.IServerAddressesFeature>();
var url = addressFeature!.Addresses.First();
log.Info("Kestrel listening at " + url);

// ── Photino Window ────────────────────────────────────────────────────────────
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
