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

namespace Owlia.Host;

public static class Program
{
    // WebView2 requires the window-creating thread to be STA. Top-level
    // statements cannot carry [STAThread], so Main is declared explicitly here.
    [STAThread]
    public static void Main(string[] args)
    {
        // ── Logging ───────────────────────────────────────────────────────────
        var logRepository = LogManager.GetRepository(Assembly.GetExecutingAssembly());
        XmlConfigurator.Configure(logRepository,
            new FileInfo(Path.Combine(AppContext.BaseDirectory, "log4net.config")));
        var log = LogManager.GetLogger(typeof(Program));

        // ── Paths ─────────────────────────────────────────────────────────────
        var dataDir = Path.Combine(AppContext.BaseDirectory, "data");
        Directory.CreateDirectory(dataDir);
        var dbPath = Path.Combine(dataDir, "owlia.db");

        // ── Web Application Builder ──────────────────────────────────────────
        var builder = WebApplication.CreateBuilder(args);

        builder.Services.ConfigureHttpJsonOptions(opts =>
        {
            opts.SerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        });

        // Port is configurable via appsettings.json ("Owlia:Port"), the
        // Owlia__Port environment variable, or a command-line arg
        // (--Owlia:Port=xxxx). 0 means "let the OS pick a free port" — Photino
        // reads the actual bound address back from IServerAddressesFeature below.
        // Default (5174) also matches the Vite dev-server proxy target.
        var port = builder.Configuration.GetValue("Owlia:Port", 5174);
        builder.WebHost.UseUrls($"http://127.0.0.1:{port}");

        builder.Services.AddDbContext<OwliaDbContext>(options =>
            options.UseSqlite($"Data Source={dbPath}"));
        builder.Services.AddScoped<ISessionRepository, SessionRepository>();

        builder.Services.AddSingleton<IModelManagerService, ModelManager>();
        builder.Services.AddScoped<ITranscriptService, TranscriptService>();
        builder.Services.AddScoped<ISentimentService, SentimentService>();
        builder.Services.AddScoped<ISummaryService, SummaryService>();
        builder.Services.AddScoped<ITtsService, TtsService>();

        builder.Services.AddSignalR();
        builder.Services.AddSingleton<IPipelineNotifier, SignalRPipelineNotifier>();

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
        app.MapModelApi();
        app.MapMediaApi();
        app.MapTranscriptApi();
        app.MapHistoryApi();
        app.MapTtsApi();
        app.MapCliApi();

        app.MapHub<ProgressHub>("/hub/progress");

        // SPA fallback — serve index.html for all non-API, non-file routes so
        // React Router's BrowserRouter can handle client-side routes.
        app.MapFallbackToFile("index.html");

        // Start Kestrel synchronously on this STA thread — no cross-thread hop
        // before the WebView2 window is created.
        app.StartAsync().GetAwaiter().GetResult();

        var server = app.Services.GetRequiredService<Microsoft.AspNetCore.Hosting.Server.IServer>();
        var addressFeature = server.Features
            .Get<Microsoft.AspNetCore.Hosting.Server.Features.IServerAddressesFeature>();
        var url = addressFeature!.Addresses.First();
        log.Info("Kestrel listening at " + url);

        // ── Photino Window ────────────────────────────────────────────────────
        var window = new PhotinoWindow()
            .SetTitle("OWLIA — Offline Voice & Language Intelligence Analytics")
            .SetUseOsDefaultSize(false)
            .SetSize(new System.Drawing.Size(1440, 900))
            .Center()
            .SetResizable(true)
            .Load(url);

        window.WaitForClose();

        log.Info("Window closed, shutting down host.");
        app.StopAsync().GetAwaiter().GetResult();
    }
}
