using Microsoft.ML.OnnxRuntime;
using Microsoft.ML.OnnxRuntime.Tensors;

namespace Owlia.AI.Vad;

/// <summary>
/// Runs Silero VAD (silero_vad.onnx) on a 16 kHz mono float[] audio array.
/// Returns a list of voice-active segments (start/end in seconds).
/// </summary>
public sealed class SileroVadRunner : IDisposable
{
    private const int SampleRate = 16000;
    private const int WindowSizeSamples = 512; // Silero VAD internal chunk size
    private const float Threshold = 0.5f;
    private const float MinSilenceDurationSec = 0.3f;
    private const float SpeechPadSec = 0.1f;

    private readonly InferenceSession _session;

    public SileroVadRunner(string modelPath)
    {
        var opts = new SessionOptions { ExecutionMode = ExecutionMode.ORT_SEQUENTIAL };
        _session = new InferenceSession(modelPath, opts);
    }

    public List<VadSegment> Run(float[] audio)
    {
        int minSilenceSamples = (int)(MinSilenceDurationSec * SampleRate);
        int speechPadSamples = (int)(SpeechPadSec * SampleRate);

        // State tensors (reset per call)
        var h = new float[2, 1, 64];
        var c = new float[2, 1, 64];

        var probs = new List<float>();

        int totalChunks = (int)Math.Ceiling((double)audio.Length / WindowSizeSamples);

        for (int i = 0; i < totalChunks; i++)
        {
            int start = i * WindowSizeSamples;
            int end = Math.Min(start + WindowSizeSamples, audio.Length);
            var chunk = new float[WindowSizeSamples]; // zero-padded if needed
            Array.Copy(audio, start, chunk, 0, end - start);

            var inputTensor = new DenseTensor<float>(chunk, new[] { 1, WindowSizeSamples });
            var srTensor = new DenseTensor<long>(new[] { (long)SampleRate }, new[] { 1 });
            var hTensor = new DenseTensor<float>(Flatten(h), new[] { 2, 1, 64 });
            var cTensor = new DenseTensor<float>(Flatten(c), new[] { 2, 1, 64 });

            var inputs = new List<NamedOnnxValue>
            {
                NamedOnnxValue.CreateFromTensor("input", inputTensor),
                NamedOnnxValue.CreateFromTensor("sr", srTensor),
                NamedOnnxValue.CreateFromTensor("h", hTensor),
                NamedOnnxValue.CreateFromTensor("c", cTensor),
            };

            using var results = _session.Run(inputs);
            var outputArr = results.First().AsEnumerable<float>().ToArray();
            probs.Add(outputArr[0]);

            // Update state
            var hn = results.Skip(1).First().AsEnumerable<float>().ToArray();
            var cn = results.Skip(2).First().AsEnumerable<float>().ToArray();
            Unflatten(hn, h);
            Unflatten(cn, c);
        }

        return ProbaToSegments(probs, audio.Length, speechPadSamples, minSilenceSamples);
    }

    private List<VadSegment> ProbaToSegments(
        List<float> probs, int totalSamples, int speechPad, int minSilence)
    {
        var segments = new List<VadSegment>();
        bool inSpeech = false;
        int speechStart = 0;
        int silenceCount = 0;

        for (int i = 0; i < probs.Count; i++)
        {
            int sampleIdx = i * WindowSizeSamples;
            if (probs[i] >= Threshold)
            {
                if (!inSpeech)
                {
                    speechStart = Math.Max(0, sampleIdx - speechPad);
                    inSpeech = true;
                }
                silenceCount = 0;
            }
            else
            {
                if (inSpeech)
                {
                    silenceCount += WindowSizeSamples;
                    if (silenceCount >= minSilence)
                    {
                        int speechEnd = Math.Min(totalSamples, sampleIdx + speechPad);
                        segments.Add(new VadSegment
                        {
                            StartSec = (double)speechStart / SampleRate,
                            EndSec = (double)speechEnd / SampleRate,
                        });
                        inSpeech = false;
                        silenceCount = 0;
                    }
                }
            }
        }

        // Close any open segment
        if (inSpeech)
        {
            segments.Add(new VadSegment
            {
                StartSec = (double)speechStart / SampleRate,
                EndSec = (double)totalSamples / SampleRate,
            });
        }

        return segments;
    }

    // ── Tensor helpers ─────────────────────────────────────────────────────

    private static float[] Flatten(float[,,] arr)
    {
        int total = arr.GetLength(0) * arr.GetLength(1) * arr.GetLength(2);
        var flat = new float[total];
        Buffer.BlockCopy(arr, 0, flat, 0, total * sizeof(float));
        return flat;
    }

    private static void Unflatten(float[] flat, float[,,] arr)
    {
        Buffer.BlockCopy(flat, 0, arr, 0, flat.Length * sizeof(float));
    }

    public void Dispose() => _session.Dispose();
}

public sealed class VadSegment
{
    public double StartSec { get; set; }
    public double EndSec { get; set; }
}
