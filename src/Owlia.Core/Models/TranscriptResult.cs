namespace Owlia.Core.Models;

public sealed class TranscriptResult
{
    public string SessionId { get; set; } = string.Empty;
    public List<SpeakerSegment> Segments { get; set; } = [];
}
