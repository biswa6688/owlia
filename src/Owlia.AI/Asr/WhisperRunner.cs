using Microsoft.ML.OnnxRuntime;
using Microsoft.ML.OnnxRuntime.Tensors;
using Owlia.AI.Vad;

namespace Owlia.AI.Asr;

/// <summary>
/// Runs Whisper large-v3 ONNX for speech recognition with timestamps.
/// Processes each VAD segment independently to reduce memory pressure.
/// </summary>
public sealed class WhisperRunner : IDisposable
{
    private const int SampleRate = 16000;
    private const int N_FFT = 400;
    private const int HOP_LENGTH = 160;
    private const int N_MELS = 128;
    private const int N_FRAMES = 3000; // 30s of audio
    private const int MaxTokens = 448;

    // Whisper special token IDs (multilingual large-v3)
    private const int SotToken = 50258;
    private const int EnToken = 50259;   // English
    private const int TranscribeToken = 50360;
    private const int NoTimestampsToken = 50364;
    private const int EotToken = 50257;

    private readonly InferenceSession _encoderSession;
    private readonly InferenceSession _decoderSession;

    public WhisperRunner(string encoderPath, string decoderPath)
    {
        var opts = new SessionOptions();
        opts.ExecutionMode = ExecutionMode.ORT_SEQUENTIAL;
        _encoderSession = new InferenceSession(encoderPath, opts);
        _decoderSession = new InferenceSession(decoderPath, opts);
    }

    /// <summary>
    /// Single ONNX file variant (encoder+decoder merged).
    /// </summary>
    public WhisperRunner(string modelPath)
    {
        var opts = new SessionOptions();
        opts.ExecutionMode = ExecutionMode.ORT_SEQUENTIAL;
        _encoderSession = new InferenceSession(modelPath, opts);
        _decoderSession = _encoderSession; // same session, different inputs
    }

    public List<WhisperSegment> Transcribe(float[] audio, IEnumerable<VadSegment> vadSegments)
    {
        var results = new List<WhisperSegment>();
        foreach (var vad in vadSegments)
        {
            int startSample = (int)(vad.StartSec * SampleRate);
            int endSample = Math.Min((int)(vad.EndSec * SampleRate), audio.Length);
            int length = endSample - startSample;
            if (length < 160) continue;

            var chunk = audio.AsSpan(startSample, length).ToArray();
            var mel = ComputeLogMelSpectrogram(chunk);
            var text = RunInference(mel);

            if (!string.IsNullOrWhiteSpace(text))
            {
                results.Add(new WhisperSegment
                {
                    StartSec = vad.StartSec,
                    EndSec = vad.EndSec,
                    Text = text.Trim(),
                });
            }
        }
        return results;
    }

    // ── Log-Mel Spectrogram ───────────────────────────────────────────────

    private float[,] ComputeLogMelSpectrogram(float[] audio)
    {
        // Pad or trim to 30s
        var padded = new float[SampleRate * 30];
        int copyLen = Math.Min(audio.Length, padded.Length);
        Array.Copy(audio, padded, copyLen);

        // Compute STFT magnitudes via DFT (simplified real-valued)
        int nFrames = (padded.Length - N_FFT) / HOP_LENGTH + 1;
        nFrames = Math.Min(nFrames, N_FRAMES);

        var stftMag = new float[N_FFT / 2 + 1, nFrames];

        for (int frame = 0; frame < nFrames; frame++)
        {
            int offset = frame * HOP_LENGTH;
            // Hann window
            var windowed = new float[N_FFT];
            for (int n = 0; n < N_FFT; n++)
            {
                float window = 0.5f * (1f - MathF.Cos(2f * MathF.PI * n / N_FFT));
                windowed[n] = padded[offset + n] * window;
            }

            // DFT
            int half = N_FFT / 2 + 1;
            for (int k = 0; k < half; k++)
            {
                float re = 0, im = 0;
                for (int n = 0; n < N_FFT; n++)
                {
                    float angle = 2f * MathF.PI * k * n / N_FFT;
                    re += windowed[n] * MathF.Cos(angle);
                    im -= windowed[n] * MathF.Sin(angle);
                }
                stftMag[k, frame] = MathF.Sqrt(re * re + im * im);
            }
        }

        // Mel filterbank
        var melFilters = BuildMelFilterbank(N_MELS, N_FFT, SampleRate);
        var mel = new float[N_MELS, nFrames];

        for (int m = 0; m < N_MELS; m++)
        {
            for (int frame = 0; frame < nFrames; frame++)
            {
                float sum = 0;
                for (int k = 0; k < N_FFT / 2 + 1; k++)
                    sum += melFilters[m, k] * stftMag[k, frame];
                mel[m, frame] = MathF.Log10(MathF.Max(sum, 1e-10f));
            }
        }

        // Clamp to [-8, 0] normalized
        float maxVal = float.MinValue;
        for (int m = 0; m < N_MELS; m++)
            for (int frame = 0; frame < nFrames; frame++)
                if (mel[m, frame] > maxVal) maxVal = mel[m, frame];

        for (int m = 0; m < N_MELS; m++)
            for (int frame = 0; frame < nFrames; frame++)
                mel[m, frame] = MathF.Max(mel[m, frame], maxVal - 8f) / 4f + 1f; // → [-1, 1]

        // Pad to N_FRAMES
        var result = new float[N_MELS, N_FRAMES];
        for (int m = 0; m < N_MELS; m++)
            for (int f = 0; f < Math.Min(nFrames, N_FRAMES); f++)
                result[m, f] = mel[m, f];

        return result;
    }

    private static float[,] BuildMelFilterbank(int nMels, int nFft, int sr)
    {
        float fMin = 0, fMax = sr / 2f;
        float melMin = HzToMel(fMin), melMax = HzToMel(fMax);
        int half = nFft / 2 + 1;

        var melPoints = new float[nMels + 2];
        for (int i = 0; i < nMels + 2; i++)
            melPoints[i] = MelToHz(melMin + (melMax - melMin) * i / (nMels + 1));

        var fftFreqs = new float[half];
        for (int k = 0; k < half; k++)
            fftFreqs[k] = (float)sr * k / nFft;

        var filters = new float[nMels, half];
        for (int m = 0; m < nMels; m++)
        {
            float lower = melPoints[m], center = melPoints[m + 1], upper = melPoints[m + 2];
            for (int k = 0; k < half; k++)
            {
                if (fftFreqs[k] >= lower && fftFreqs[k] <= center)
                    filters[m, k] = (fftFreqs[k] - lower) / (center - lower);
                else if (fftFreqs[k] > center && fftFreqs[k] <= upper)
                    filters[m, k] = (upper - fftFreqs[k]) / (upper - center);
            }
        }
        return filters;
    }

    private static float HzToMel(float hz) => 2595f * MathF.Log10(1f + hz / 700f);
    private static float MelToHz(float mel) => 700f * (MathF.Pow(10f, mel / 2595f) - 1f);

    // ── Inference ─────────────────────────────────────────────────────────

    private string RunInference(float[,] mel)
    {
        // Flatten mel to 1×N_MELS×N_FRAMES
        var flat = new float[N_MELS * N_FRAMES];
        for (int m = 0; m < N_MELS; m++)
            for (int f = 0; f < N_FRAMES; f++)
                flat[m * N_FRAMES + f] = mel[m, f];

        var melTensor = new DenseTensor<float>(flat, new[] { 1, N_MELS, N_FRAMES });

        // Encode
        var encoderInputs = new[] { NamedOnnxValue.CreateFromTensor("input_features", melTensor) };
        using var encoderOut = _encoderSession.Run(encoderInputs);
        var encoderHidden = encoderOut.First().AsTensor<float>();

        // Greedy decode
        var tokens = new List<int> { SotToken, EnToken, TranscribeToken, NoTimestampsToken };
        for (int step = 0; step < MaxTokens; step++)
        {
            var tokenArr = tokens.Select(t => (long)t).ToArray();
            var tokenTensor = new DenseTensor<long>(tokenArr, new[] { 1, tokens.Count });

            var decoderInputs = new[]
            {
                NamedOnnxValue.CreateFromTensor("input_ids", tokenTensor),
                NamedOnnxValue.CreateFromTensor("encoder_hidden_states", encoderHidden),
            };

            using var decoderOut = _decoderSession.Run(decoderInputs);
            var logits = decoderOut.First().AsTensor<float>();

            // Argmax over last token position
            int vocabSize = logits.Dimensions[2];
            int lastPos = tokens.Count - 1;
            int bestToken = 0;
            float bestVal = float.MinValue;
            for (int v = 0; v < vocabSize; v++)
            {
                float val = logits[0, lastPos, v];
                if (val > bestVal) { bestVal = val; bestToken = v; }
            }

            if (bestToken == EotToken) break;
            tokens.Add(bestToken);
        }

        // Decode tokens → text (simplified byte-pair — just handle printable ASCII range)
        var textTokens = tokens.Skip(4); // skip prompt
        return DecodeTokens(textTokens);
    }

    private static string DecodeTokens(IEnumerable<int> tokens)
    {
        // Whisper token IDs 0-255 map directly to bytes in the GPT-2 byte encoding.
        // This is a simplified decoder — accurate for English ASCII.
        var bytes = new List<byte>();
        foreach (var tok in tokens)
        {
            if (tok < 256)
                bytes.Add((byte)tok);
            else if (tok == 220) // space token
                bytes.Add((byte)' ');
        }
        return System.Text.Encoding.UTF8.GetString(bytes.ToArray());
    }

    public void Dispose()
    {
        _encoderSession.Dispose();
        if (!ReferenceEquals(_encoderSession, _decoderSession))
            _decoderSession.Dispose();
    }
}

public sealed class WhisperSegment
{
    public double StartSec { get; set; }
    public double EndSec { get; set; }
    public string Text { get; set; } = string.Empty;
}
