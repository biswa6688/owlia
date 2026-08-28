namespace Owlia.Data.Entities;

public class SegmentEntity
{
    public string Id { get; set; } = string.Empty;
    public string SessionId { get; set; } = string.Empty;
    public string Speaker { get; set; } = string.Empty;
    public long StartMs { get; set; }
    public long EndMs { get; set; }
    public string Text { get; set; } = string.Empty;
    public double SentimentScore { get; set; }
    public string SentimentLabel { get; set; } = string.Empty;
    public double Confidence { get; set; }

    public SessionEntity? Session { get; set; }
}
