using Microsoft.ML.OnnxRuntime;
using Microsoft.ML.OnnxRuntime.Tensors;

namespace Owlia.AI.Tts;

/// <summary>
/// Kokoro v1.0 TTS ONNX — converts text to PCM audio at 24 kHz.
/// Returns WAV bytes.
/// </summary>
public sealed class KokoroRunner : IDisposable
{
    private const int SampleRate = 24000;

    private readonly InferenceSession _session;

    // Built-in phoneme-to-ID mapping (simplified English subset)
    private static readonly Dictionary<char, int> _phonemeMap = BuildPhonemeMap();

    public KokoroRunner(string modelPath)
    {
        var opts = new SessionOptions { ExecutionMode = ExecutionMode.ORT_SEQUENTIAL };
        _session = new InferenceSession(modelPath, opts);
    }

    /// <summary>
    /// Synthesises text to WAV bytes.
    /// </summary>
    public byte[] Synthesize(string text, string voice = "af_heart")
    {
        var tokens = TextToTokens(text);
        var tokenTensor = new DenseTensor<long>(tokens, new[] { 1, tokens.Length });

        // Voice style embedding (Kokoro uses a 256-dim style vector — use zeros as neutral)
        var style = new float[1 * 256];
        var styleTensor = new DenseTensor<float>(style, new[] { 1, 256 });

        // Speed factor
        var speedTensor = new DenseTensor<float>(new[] { 1.0f }, new[] { 1 });

        var inputs = new[]
        {
            NamedOnnxValue.CreateFromTensor("tokens", tokenTensor),
            NamedOnnxValue.CreateFromTensor("style", styleTensor),
            NamedOnnxValue.CreateFromTensor("speed", speedTensor),
        };

        using var outputs = _session.Run(inputs);
        var audio = outputs.First().AsEnumerable<float>().ToArray();

        return PcmToWav(audio, SampleRate);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private static long[] TextToTokens(string text)
    {
        var tokens = new List<long> { 0 }; // BOS
        foreach (char c in text.ToLowerInvariant())
        {
            if (_phonemeMap.TryGetValue(c, out int id))
                tokens.Add(id);
        }
        tokens.Add(0); // EOS
        return tokens.ToArray();
    }

    private static Dictionary<char, int> BuildPhonemeMap()
    {
        // Simple ASCII character map: offset by 32 so printable chars get IDs 1-95
        var map = new Dictionary<char, int>();
        for (char c = ' '; c <= '~'; c++)
            map[c] = c - 31; // space=1, !≡2, … z≡91
        return map;
    }

    private static byte[] PcmToWav(float[] pcm, int sampleRate)
    {
        // Convert float[] to 16-bit PCM WAV
        using var ms = new MemoryStream();
        using var writer = new System.IO.BinaryWriter(ms);

        short[] samples = pcm.Select(f => (short)Math.Clamp(f * 32767f, -32768, 32767)).ToArray();
        int byteCount = samples.Length * 2;

        // RIFF header
        writer.Write(System.Text.Encoding.ASCII.GetBytes("RIFF"));
        writer.Write(36 + byteCount);
        writer.Write(System.Text.Encoding.ASCII.GetBytes("WAVE"));

        // fmt chunk
        writer.Write(System.Text.Encoding.ASCII.GetBytes("fmt "));
        writer.Write(16);          // chunk size
        writer.Write((short)1);    // PCM
        writer.Write((short)1);    // mono
        writer.Write(sampleRate);
        writer.Write(sampleRate * 2); // byte rate
        writer.Write((short)2);    // block align
        writer.Write((short)16);   // bits per sample

        // data chunk
        writer.Write(System.Text.Encoding.ASCII.GetBytes("data"));
        writer.Write(byteCount);
        foreach (var s in samples)
            writer.Write(s);

        return ms.ToArray();
    }

    public void Dispose() => _session.Dispose();
}
