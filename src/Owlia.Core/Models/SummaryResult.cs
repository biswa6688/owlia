namespace Owlia.Core.Models;

public sealed class SummaryResult
{
    public string SessionId { get; set; } = string.Empty;
    public string Summary { get; set; } = string.Empty;
    public List<string> Keywords { get; set; } = [];
    public List<string> KeyTakeaways { get; set; } = [];

    /// <summary>Percentage (0-100) of the media that is actual speech, per Silero VAD — silence/noise excluded.</summary>
    public double SpeechPercentage { get; set; }
}
