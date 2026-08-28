namespace Owlia.Core.Models;

public sealed class SpeakerSegment
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string SessionId { get; set; } = string.Empty;
    public string Speaker { get; set; } = string.Empty;
    public long StartMs { get; set; }
    public long EndMs { get; set; }
    public string Text { get; set; } = string.Empty;
    public double Confidence { get; set; }
    public double SentimentScore { get; set; }
    public string SentimentLabel { get; set; } = string.Empty;
}
