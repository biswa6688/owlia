using Microsoft.ML.OnnxRuntime;
using Microsoft.ML.OnnxRuntime.Tensors;

namespace Owlia.AI.Diarization;

/// <summary>
/// WeSpeaker ECAPA-TDNN — produces 256-dim speaker embedding vectors.
/// Used to cluster segments into speaker identities.
/// </summary>
public sealed class EmbeddingRunner : IDisposable
{
    private const int SampleRate = 16000;
    private const int EmbeddingDim = 256;

    private readonly InferenceSession _session;

    public EmbeddingRunner(string modelPath)
    {
        var opts = new SessionOptions { ExecutionMode = ExecutionMode.ORT_SEQUENTIAL };
        _session = new InferenceSession(modelPath, opts);
    }

    /// <summary>
    /// Returns a 256-dim L2-normalised embedding for the given audio chunk.
    /// </summary>
    public float[] GetEmbedding(float[] audio)
    {
        // WeSpeaker expects FBank features — use raw audio with the model's internal feature extractor
        var tensor = new DenseTensor<float>(audio, new[] { 1, audio.Length });
        var srTensor = new DenseTensor<long>(new[] { (long)SampleRate }, new[] { 1 });

        var inputs = new[]
        {
            NamedOnnxValue.CreateFromTensor("input", tensor),
        };

        using var outputs = _session.Run(inputs);
        var embedding = outputs.First().AsEnumerable<float>().ToArray();

        // L2 normalise
        return L2Normalize(embedding);
    }

    private static float[] L2Normalize(float[] v)
    {
        float norm = MathF.Sqrt(v.Sum(x => x * x));
        if (norm < 1e-10f) return v;
        return v.Select(x => x / norm).ToArray();
    }

    public void Dispose() => _session.Dispose();
}
