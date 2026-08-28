using Owlia.Core.Services;

namespace Owlia.Host.Api;

public static class TtsApi
{
    public static void MapTtsApi(this WebApplication app)
    {
        // POST /api/tts  { text, voice }  → audio/wav stream
        app.MapPost("/api/tts", async (
            TtsRequest req,
            ITtsService tts,
            CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(req.Text))
                return Results.BadRequest(new { error = "text is required" });

            var voice = req.Voice ?? "af_heart";
            var audioBytes = await tts.SynthesizeAsync(req.Text, voice, ct);
            return Results.File(audioBytes, "audio/wav", "speech.wav");
        });
    }

    private sealed record TtsRequest(string Text, string? Voice);
}
