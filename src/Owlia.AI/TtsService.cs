using Owlia.AI.Tts;
using Owlia.Core.Services;

namespace Owlia.AI;

public sealed class TtsService : ITtsService
{
    private readonly IModelManagerService _models;

    public TtsService(IModelManagerService models)
    {
        _models = models;
    }

    public Task<byte[]> SynthesizeAsync(string text, string voice, CancellationToken ct = default)
    {
        var modelPath = _models.GetModelPath("kokoro-tts");
        if (!File.Exists(modelPath))
            throw new InvalidOperationException("Kokoro TTS model not downloaded. Go to the Download page.");

        using var runner = new KokoroRunner(modelPath);
        var wav = runner.Synthesize(text, voice);
        return Task.FromResult(wav);
    }
}
