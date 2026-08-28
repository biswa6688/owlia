namespace Owlia.Core.Models;

public sealed class ModelStatus
{
    public string Id { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string Feature { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public string Sha256 { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
    public bool Downloaded { get; set; }
    public bool Verified { get; set; }

    /// <summary>Bytes already on disk toward SizeBytes — meaningful when a download is paused (partial .tmp file present).</summary>
    public long PartialBytes { get; set; }
    public bool IsPaused { get; set; }
}
