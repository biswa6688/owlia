namespace Owlia.Data.Entities;

public class SessionEntity
{
    public string Id { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string FilePath { get; set; } = string.Empty;
    public double DurationSeconds { get; set; }
    public int SpeakerCount { get; set; }
    public DateTime CreatedAt { get; set; }

    public List<SegmentEntity> Segments { get; set; } = [];
    public SummaryEntity? Summary { get; set; }
}
