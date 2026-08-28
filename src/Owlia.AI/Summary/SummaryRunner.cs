using System.Text.RegularExpressions;
using LLama;
using LLama.Common;

namespace Owlia.AI.Summary;

/// <summary>
/// Summarization via a small local instruct LLM (Qwen2.5-1.5B-Instruct GGUF)
/// through LLamaSharp/llama.cpp — replaces the previous hand-rolled BART ONNX
/// decode loop, which used a placeholder char-mapping tokenizer instead of
/// real BPE. Summary, keywords, and takeaways are all produced by prompting,
/// in one inference call, parsed from a fixed labeled-section format.
/// </summary>
public sealed class SummaryRunner : IDisposable
{
    private const int ContextSize = 4096;
    private const int MaxInputChars = 6000; // ~1500 tokens, leaves room for prompt + output in the 4096 context
    private const int MaxOutputTokens = 512;

    private readonly LLamaWeights _weights;
    private readonly StatelessExecutor _executor;

    public SummaryRunner(string modelPath)
    {
        var parameters = new ModelParams(modelPath)
        {
            ContextSize = ContextSize,
            GpuLayerCount = 0, // CPU-only — matches the rest of the pipeline
        };
        _weights = LLamaWeights.LoadFromFile(parameters);
        _executor = new StatelessExecutor(_weights, parameters);
    }

    public async Task<(string Summary, List<string> Keywords, List<string> KeyTakeaways)> SummarizeAsync(string fullText, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(fullText))
            return (string.Empty, new List<string>(), new List<string>());

        var input = fullText.Length > MaxInputChars ? fullText[..MaxInputChars] : fullText;

        var prompt =
            "<|im_start|>system\nYou are a concise meeting-notes assistant.<|im_end|>\n" +
            $"<|im_start|>user\nTranscript:\n{input}\n\n" +
            "Respond with exactly this format, filling in each part. Do not stop until all three sections are written.\n\n" +
            "SUMMARY: <one paragraph>\nKEYWORDS: <5-8 comma-separated words>\nTAKEAWAYS:\n1. <point>\n2. <point>\n3. <point><|im_end|>\n<|im_start|>assistant\n";

        var inferenceParams = new InferenceParams
        {
            MaxTokens = MaxOutputTokens,
            AntiPrompts = ["<|im_end|>", "<|im_start|>"],
        };

        var output = new System.Text.StringBuilder();
        await foreach (var token in _executor.InferAsync(prompt, inferenceParams, ct))
            output.Append(token);

        return ParseSections(output.ToString());
    }

    private static (string, List<string>, List<string>) ParseSections(string text)
    {
        var summary = ExtractSection(text, "SUMMARY:", "KEYWORDS:");
        var keywordsRaw = ExtractSection(text, "KEYWORDS:", "TAKEAWAYS:");
        var takeawaysRaw = ExtractSection(text, "TAKEAWAYS:", null);

        var keywords = keywordsRaw
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(k => k.Length > 0)
            .ToList();

        var takeaways = takeawaysRaw
            .Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(line => Regex.Replace(line, @"^\d+[\.\)]\s*", ""))
            .Where(line => line.Length > 0)
            .ToList();

        return (summary, keywords, takeaways);
    }

    private static string ExtractSection(string text, string label, string? nextLabel)
    {
        var start = text.IndexOf(label, StringComparison.OrdinalIgnoreCase);
        if (start < 0) return string.Empty;
        start += label.Length;

        var end = nextLabel is not null
            ? text.IndexOf(nextLabel, start, StringComparison.OrdinalIgnoreCase)
            : -1;
        if (end < 0) end = text.Length;

        return text[start..end].Trim();
    }

    /// <summary>Frequency-based fallback keyword extraction when the LLM model isn't downloaded.</summary>
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

    public void Dispose()
    {
        _executor.Context.Dispose();
        _weights.Dispose();
    }
}
