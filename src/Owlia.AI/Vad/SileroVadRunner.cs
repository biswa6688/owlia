using SherpaOnnx;

namespace Owlia.AI.Vad;

/// <summary>
/// Voice activity detection via sherpa-onnx's VoiceActivityDetector (wraps
/// Silero VAD internally — handles model-version input/state details itself,
/// unlike the previous hand-rolled ONNX Runtime implementation).
/// </summary>
public sealed class SileroVadRunner : IDisposable
{
    private const int SampleRate = 16000;
    private const int WindowSize = 512;

    private readonly VoiceActivityDetector _vad;

    public SileroVadRunner(string modelPath)
    {
        var config = new VadModelConfig();
        config.SileroVad.Model = modelPath;
        config.SileroVad.Threshold = 0.5f;
        config.SileroVad.MinSilenceDuration = 0.3f;
        config.SileroVad.MinSpeechDuration = 0.25f;
        config.SileroVad.MaxSpeechDuration = float.MaxValue;
        config.SileroVad.WindowSize = WindowSize;
        config.SampleRate = SampleRate;

        // Buffer size in seconds — how much audio the detector can hold
        // internally before segments must be drained. 60s is comfortably
        // larger than any single VAD segment we expect.
        _vad = new VoiceActivityDetector(config, 60);
    }

    public List<VadSegment> Run(float[] audio)
    {
        var results = new List<VadSegment>();
        int numIter = audio.Length / WindowSize;

        for (int i = 0; i < numIter; i++)
        {
            var chunk = new float[WindowSize];
            Array.Copy(audio, i * WindowSize, chunk, 0, WindowSize);
            _vad.AcceptWaveform(chunk);
            DrainSegments(results);
        }

        _vad.Flush();
        DrainSegments(results);

        return results;
    }

    private void DrainSegments(List<VadSegment> results)
    {
        while (!_vad.IsEmpty())
        {
            var segment = _vad.Front();
            results.Add(new VadSegment
            {
                StartSec = segment.Start / (double)SampleRate,
                EndSec = (segment.Start + segment.Samples.Length) / (double)SampleRate,
            });
            _vad.Pop();
        }
    }

    public void Dispose() => _vad.Dispose();
}

public sealed class VadSegment
{
    public double StartSec { get; set; }
    public double EndSec { get; set; }
}
