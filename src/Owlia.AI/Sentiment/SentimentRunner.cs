using Microsoft.ML.OnnxRuntime;
using Microsoft.ML.OnnxRuntime.Tensors;

namespace Owlia.AI.Sentiment;

/// <summary>
/// RoBERTa sentiment ONNX (cardiffnlp/twitter-roberta-base-sentiment-latest).
/// Labels: 0=negative, 1=neutral, 2=positive.
/// Maps to 0-100 score: negative→0-40, neutral→41-60, positive→61-100.
/// </summary>
public sealed class SentimentRunner : IDisposable
{
    private const int MaxSeqLen = 512;
    private const int PadToken = 1;
    private const int ClsToken = 0;
    private const int SepToken = 2;

    private readonly InferenceSession _session;
    private readonly Dictionary<string, int> _vocab;

    public SentimentRunner(string modelPath, string vocabPath)
    {
        var opts = new SessionOptions { ExecutionMode = ExecutionMode.ORT_SEQUENTIAL };
        _session = new InferenceSession(modelPath, opts);

        // Load vocab (simple JSON dict string→int, or merges.txt style)
        _vocab = LoadVocab(vocabPath);
    }

    public SentimentRunner(string modelPath)
    {
        var opts = new SessionOptions { ExecutionMode = ExecutionMode.ORT_SEQUENTIAL };
        _session = new InferenceSession(modelPath, opts);
        _vocab = new Dictionary<string, int>(); // fallback: character-level tokenization
    }

    /// <summary>
    /// Returns score 0-100 and label for the given text.
    /// </summary>
    public (double Score, string Label) Analyze(string text)
    {
        var inputIds = Tokenize(text);
        var attnMask = inputIds.Select(id => id != PadToken ? 1L : 0L).ToArray();

        var idsTensor = new DenseTensor<long>(inputIds, new[] { 1, inputIds.Length });
        var maskTensor = new DenseTensor<long>(attnMask, new[] { 1, inputIds.Length });

        var inputs = new[]
        {
            NamedOnnxValue.CreateFromTensor("input_ids", idsTensor),
            NamedOnnxValue.CreateFromTensor("attention_mask", maskTensor),
        };

        using var outputs = _session.Run(inputs);
        var logits = outputs.First().AsEnumerable<float>().ToArray();

        // Softmax
        var probs = Softmax(logits);
        int predicted = probs.ToList().IndexOf(probs.Max());

        // Map to 0-100
        double score = predicted switch
        {
            0 => probs[0] * 40,               // negative: 0-40
            1 => 40 + probs[1] * 20,          // neutral: 41-60
            2 => 60 + probs[2] * 40,          // positive: 61-100
            _ => 50,
        };

        string label = predicted switch
        {
            0 => "Negative",
            1 => "Neutral",
            2 => "Positive",
            _ => "Neutral",
        };

        return (Math.Round(score, 1), label);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private long[] Tokenize(string text)
    {
        // Word-piece style: split on spaces, map to vocab ids, truncate.
        var tokens = new List<long> { ClsToken };
        foreach (var word in text.Split(' ', StringSplitOptions.RemoveEmptyEntries))
        {
            var lower = word.ToLowerInvariant();
            if (_vocab.TryGetValue(lower, out int id))
                tokens.Add(id);
            else
            {
                // Character-level fallback
                foreach (var ch in lower)
                    if (_vocab.TryGetValue(ch.ToString(), out int cid))
                        tokens.Add(cid);
                    else
                        tokens.Add(3); // <unk>
            }
            if (tokens.Count >= MaxSeqLen - 1) break;
        }
        tokens.Add(SepToken);

        // Pad
        while (tokens.Count < MaxSeqLen)
            tokens.Add(PadToken);

        return tokens.Take(MaxSeqLen).Select(t => (long)t).ToArray();
    }

    private static float[] Softmax(float[] logits)
    {
        float max = logits.Max();
        var exp = logits.Select(x => MathF.Exp(x - max)).ToArray();
        float sum = exp.Sum();
        return exp.Select(x => x / sum).ToArray();
    }

    private static Dictionary<string, int> LoadVocab(string path)
    {
        try
        {
            var lines = File.ReadAllLines(path);
            var dict = new Dictionary<string, int>();
            for (int i = 0; i < lines.Length; i++)
                dict[lines[i].Trim()] = i;
            return dict;
        }
        catch { return new Dictionary<string, int>(); }
    }

    public void Dispose() => _session.Dispose();
}
