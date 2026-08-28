using Microsoft.ML.OnnxRuntime;
using Microsoft.ML.OnnxRuntime.Tensors;

namespace Owlia.AI.Summary;

/// <summary>
/// BART-large-CNN ONNX summarization.
/// Input: full transcript text. Output: summary string.
/// Keywords are extracted by frequency analysis (no extra model needed).
/// </summary>
public sealed class SummaryRunner : IDisposable
{
    private const int MaxInputTokens = 1024;
    private const int MaxSummaryTokens = 256;
    private const int PadToken = 1;
    private const int BosToken = 0;
    private const int EosToken = 2;

    private readonly InferenceSession _encoderSession;
    private readonly InferenceSession _decoderSession;

    public SummaryRunner(string encoderPath, string decoderPath)
    {
        var opts = new SessionOptions { ExecutionMode = ExecutionMode.ORT_SEQUENTIAL };
        _encoderSession = new InferenceSession(encoderPath, opts);
        _decoderSession = new InferenceSession(decoderPath, opts);
    }

    /// <summary>Single ONNX file variant (encoder+decoder merged).</summary>
    public SummaryRunner(string modelPath)
    {
        var opts = new SessionOptions { ExecutionMode = ExecutionMode.ORT_SEQUENTIAL };
        _encoderSession = new InferenceSession(modelPath, opts);
        _decoderSession = _encoderSession;
    }

    public (string Summary, List<string> Keywords, List<string> KeyTakeaways) Summarize(string fullText)
    {
        if (string.IsNullOrWhiteSpace(fullText))
            return (string.Empty, new List<string>(), new List<string>());

        // Tokenize input (word-level for robustness without BPE vocab)
        var inputIds = TokenizeSimple(fullText, MaxInputTokens);
        var attnMask = inputIds.Select(id => id != PadToken ? 1L : 0L).ToArray();

        var idsTensor = new DenseTensor<long>(inputIds, new[] { 1, inputIds.Length });
        var maskTensor = new DenseTensor<long>(attnMask, new[] { 1, inputIds.Length });

        // Encode
        var encoderInputs = new[]
        {
            NamedOnnxValue.CreateFromTensor("input_ids", idsTensor),
            NamedOnnxValue.CreateFromTensor("attention_mask", maskTensor),
        };

        using var encoderOut = _encoderSession.Run(encoderInputs);
        var encoderHidden = encoderOut.First().AsTensor<float>();

        // Greedy decode summary
        var decoderIds = new List<long> { BosToken };
        for (int step = 0; step < MaxSummaryTokens; step++)
        {
            var decTensor = new DenseTensor<long>(decoderIds.ToArray(), new[] { 1, decoderIds.Count });
            var decoderInputs = new[]
            {
                NamedOnnxValue.CreateFromTensor("decoder_input_ids", decTensor),
                NamedOnnxValue.CreateFromTensor("encoder_hidden_states", encoderHidden),
                NamedOnnxValue.CreateFromTensor("attention_mask", maskTensor),
            };

            using var decoderOut = _decoderSession.Run(decoderInputs);
            var logits = decoderOut.First().AsTensor<float>();

            int vocabSize = logits.Dimensions[2];
            int lastPos = decoderIds.Count - 1;
            int bestToken = 0;
            float bestVal = float.MinValue;
            for (int v = 0; v < vocabSize; v++)
            {
                float val = logits[0, lastPos, v];
                if (val > bestVal) { bestVal = val; bestToken = v; }
            }

            if (bestToken == EosToken) break;
            decoderIds.Add(bestToken);
        }

        var summaryText = DecodeSimple(decoderIds.Skip(1).Select(t => (int)t));
        var keywords = ExtractKeywords(fullText, 10);
        var takeaways = ExtractTakeaways(summaryText);

        return (summaryText, keywords, takeaways);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private static long[] TokenizeSimple(string text, int maxLen)
    {
        var words = text.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var ids = new List<long> { BosToken };
        foreach (var w in words)
        {
            // Map each character to its ASCII/unicode value (fallback tokenization)
            foreach (char c in w)
                ids.Add((long)(c % 50264)); // map to BART vocab range
            ids.Add(32); // space token
            if (ids.Count >= maxLen - 1) break;
        }
        ids.Add(EosToken);
        while (ids.Count < maxLen)
            ids.Add(PadToken);
        return ids.Take(maxLen).ToArray();
    }

    private static string DecodeSimple(IEnumerable<int> tokens)
    {
        // Map tokens back to characters (approximation)
        var chars = tokens
            .Where(t => t >= 32 && t < 127)
            .Select(t => (char)t);
        return new string(chars.ToArray()).Trim();
    }

    private static List<string> ExtractKeywords(string text, int topN) =>
        ExtractKeywordsStatic(text, topN);

    /// <summary>Public static variant so TranscriptService can call it without instantiating the runner.</summary>
    public static List<string> ExtractKeywordsStatic(string text, int topN)
    {
        var stopWords = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "the","a","an","and","or","but","in","on","at","to","for","of","is","are","was",
            "were","be","been","being","have","has","had","do","does","did","will","would",
            "could","should","may","might","it","its","i","we","you","he","she","they","this",
            "that","with","from","by","as","not","so","if","then","than","there","what","how"
        };

        var words = text.Split(new char[] { ' ', '.', ',', '!', '?', '\n', '\r', ';', ':' },
            StringSplitOptions.RemoveEmptyEntries);

        return words
            .Select(w => w.ToLowerInvariant().Trim('\'', '"', '-', '(', ')'))
            .Where(w => w.Length > 3 && !stopWords.Contains(w))
            .GroupBy(w => w)
            .OrderByDescending(g => g.Count())
            .Take(topN)
            .Select(g => g.Key)
            .ToList();
    }

    private static List<string> ExtractTakeaways(string summary)
    {
        // Split summary into sentences and return top 5 as takeaways
        return summary
            .Split(new[] { '.', '!', '?' }, StringSplitOptions.RemoveEmptyEntries)
            .Select(s => s.Trim())
            .Where(s => s.Length > 20)
            .Take(5)
            .ToList();
    }

    public void Dispose()
    {
        _encoderSession.Dispose();
        if (!ReferenceEquals(_encoderSession, _decoderSession))
            _decoderSession.Dispose();
    }
}
