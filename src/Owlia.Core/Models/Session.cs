namespace Owlia.Core.Models;

public sealed class Session
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string FileName { get; set; } = string.Empty;
    public string FilePath { get; set; } = string.Empty;
    public double DurationSeconds { get; set; }
    public int SpeakerCount { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
