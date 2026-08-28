namespace Owlia.Core.Models;

public sealed class SummaryResult
{
    public string SessionId { get; set; } = string.Empty;
    public string Summary { get; set; } = string.Empty;
    public List<string> Keywords { get; set; } = [];
    public List<string> KeyTakeaways { get; set; } = [];
}
