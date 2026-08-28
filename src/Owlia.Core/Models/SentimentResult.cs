namespace Owlia.Core.Models;

public sealed class SpeakerSentiment
{
    public string Speaker { get; set; } = string.Empty;
    public double OverallScore { get; set; }
    public string OverallLabel { get; set; } = string.Empty;
}

public sealed class SentimentResult
{
    public string SessionId { get; set; } = string.Empty;
    public List<SpeakerSentiment> BySpeaker { get; set; } = [];
    public List<SpeakerSegment> Timeline { get; set; } = [];
}
