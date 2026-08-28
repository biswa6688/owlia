using Owlia.AI.Vad;
using Whisper.net;

namespace Owlia.AI.Asr;

/// <summary>
/// Runs Whisper large-v3 via Whisper.net (whisper.cpp/GGML) for speech
/// recognition with timestamps. Processes each VAD segment independently.
/// </summary>
public sealed class WhisperRunner : IDisposable
{
    private const int SampleRate = 16000;

    private readonly WhisperFactory _factory;
    private readonly WhisperProcessor _processor;

    public WhisperRunner(string modelPath)
    {
        _factory = WhisperFactory.FromPath(modelPath);
        _processor = _factory.CreateBuilder()
            .WithLanguage("auto")
            .Build();
    }

    public async Task<List<WhisperSegment>> TranscribeAsync(float[] audio, IEnumerable<VadSegment> vadSegments, CancellationToken ct = default)
    {
        var results = new List<WhisperSegment>();
        foreach (var vad in vadSegments)
        {
            int startSample = (int)(vad.StartSec * SampleRate);
            int endSample = Math.Min((int)(vad.EndSec * SampleRate), audio.Length);
            int length = endSample - startSample;
            if (length < 160) continue;

            var chunk = audio.AsMemory(startSample, length);
            var text = new System.Text.StringBuilder();

            await foreach (var segment in _processor.ProcessAsync(chunk, ct))
            {
                text.Append(segment.Text);
            }

            var t = text.ToString().Trim();
            if (!string.IsNullOrWhiteSpace(t))
            {
                results.Add(new WhisperSegment
                {
                    StartSec = vad.StartSec,
                    EndSec = vad.EndSec,
                    Text = t,
                });
            }
        }
        return results;
    }

    public void Dispose()
    {
        _processor.Dispose();
        _factory.Dispose();
    }
}

public sealed class WhisperSegment
{
    public double StartSec { get; set; }
    public double EndSec { get; set; }
    public string Text { get; set; } = string.Empty;
}
