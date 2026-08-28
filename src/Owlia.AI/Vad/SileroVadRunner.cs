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
    private const int WindowSizeSamples = 512;  // Silero VAD v5 chunk size
    private const int ContextSamples = 64;       // v5 convolutional front-end lookback
    private const int StateDim = 128;            // v5 combined recurrent state size
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

        // v5 combined state tensor [2, 1, 128] (reset per call), fed back each step
        var state = new float[2 * 1 * StateDim];

        // Rolling 64-sample context carried from the tail of the previous chunk
        // (zeros for the very first chunk) — model input is context(64) + chunk(512) = 576.
        var context = new float[ContextSamples];

        var probs = new List<float>();

        int totalChunks = (int)Math.Ceiling((double)audio.Length / WindowSizeSamples);

        for (int i = 0; i < totalChunks; i++)
        {
            int start = i * WindowSizeSamples;
            int end = Math.Min(start + WindowSizeSamples, audio.Length);
            var chunk = new float[WindowSizeSamples]; // zero-padded if needed
            Array.Copy(audio, start, chunk, 0, end - start);

            var inputBuf = new float[ContextSamples + WindowSizeSamples];
            Array.Copy(context, 0, inputBuf, 0, ContextSamples);
            Array.Copy(chunk, 0, inputBuf, ContextSamples, WindowSizeSamples);

            var inputTensor = new DenseTensor<float>(inputBuf, new[] { 1, inputBuf.Length });
            var srTensor = new DenseTensor<long>(new[] { (long)SampleRate }, Array.Empty<int>());
            var stateTensor = new DenseTensor<float>(state, new[] { 2, 1, StateDim });

            var inputs = new List<NamedOnnxValue>
            {
                NamedOnnxValue.CreateFromTensor("input", inputTensor),
                NamedOnnxValue.CreateFromTensor("sr", srTensor),
                NamedOnnxValue.CreateFromTensor("state", stateTensor),
            };

            using var results = _session.Run(inputs);
            var outputArr = results.First(r => r.Name == "output").AsEnumerable<float>().ToArray();
            probs.Add(outputArr[0]);

            var newState = results.First(r => r.Name == "stateN").AsEnumerable<float>().ToArray();
            Array.Copy(newState, state, state.Length);

            // Tail of this chunk becomes next iteration's context.
            Array.Copy(chunk, WindowSizeSamples - ContextSamples, context, 0, ContextSamples);
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

    public void Dispose() => _session.Dispose();
}

public sealed class VadSegment
{
    public double StartSec { get; set; }
    public double EndSec { get; set; }
}
