using Microsoft.ML.OnnxRuntime;
using Microsoft.ML.OnnxRuntime.Tensors;

namespace Owlia.AI.Diarization;

/// <summary>
/// Runs pyannote segmentation-3.0 ONNX model.
/// Input: 16 kHz mono PCM chunk (up to ~10s).
/// Output: speaker change boundary probabilities over time.
/// </summary>
public sealed class SegmentationRunner : IDisposable
{
    private const int SampleRate = 16000;
    private const int ChunkSamples = 160000; // 10s
    private const int StepSamples = 80000;   // 5s step (50% overlap)
    private const float Threshold = 0.5f;

    private readonly InferenceSession _session;

    public SegmentationRunner(string modelPath)
    {
        var opts = new SessionOptions { ExecutionMode = ExecutionMode.ORT_SEQUENTIAL };
        _session = new InferenceSession(modelPath, opts);
    }

    /// <summary>
    /// Returns a list of speaker-change boundaries (in seconds).
    /// </summary>
    public List<double> GetBoundaries(float[] audio)
    {
        var boundaries = new List<double>();
        int totalSamples = audio.Length;

        for (int offset = 0; offset < totalSamples; offset += StepSamples)
        {
            int end = Math.Min(offset + ChunkSamples, totalSamples);
            var chunk = new float[ChunkSamples]; // zero-pad
            Array.Copy(audio, offset, chunk, 0, end - offset);

            var tensor = new DenseTensor<float>(chunk, new[] { 1, 1, ChunkSamples });
            var inputs = new[] { NamedOnnxValue.CreateFromTensor("input_values", tensor) };

            using var outputs = _session.Run(inputs);
            var scores = outputs.First().AsEnumerable<float>().ToArray();

            // scores shape: [frames, speakers] — detect transitions above threshold
            int numFrames = scores.Length / 3; // pyannote seg-3 has 3 speaker outputs
            for (int f = 1; f < numFrames; f++)
            {
                float prevMax = 0, currMax = 0;
                for (int s = 0; s < 3; s++)
                {
                    prevMax = Math.Max(prevMax, scores[(f - 1) * 3 + s]);
                    currMax = Math.Max(currMax, scores[f * 3 + s]);
                }

                // Boundary if speaker activity flips significantly
                if (Math.Abs(currMax - prevMax) > Threshold)
                {
                    double frameTime = (double)(offset + f * (ChunkSamples / numFrames)) / SampleRate;
                    boundaries.Add(frameTime);
                }
            }
        }

        // Deduplicate boundaries within 0.3s of each other
        boundaries.Sort();
        return MergeBoundaries(boundaries, 0.3);
    }

    private static List<double> MergeBoundaries(List<double> sorted, double minGap)
    {
        var result = new List<double>();
        double last = double.MinValue;
        foreach (var b in sorted)
        {
            if (b - last >= minGap)
            {
                result.Add(b);
                last = b;
            }
        }
        return result;
    }

    public void Dispose() => _session.Dispose();
}
