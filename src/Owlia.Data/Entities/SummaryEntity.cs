namespace Owlia.Data.Entities;

public class SummaryEntity
{
    public string Id { get; set; } = string.Empty;
    public string SessionId { get; set; } = string.Empty;
    public string SummaryText { get; set; } = string.Empty;
    public string KeywordsJson { get; set; } = "[]";
    public string KeyTakeawaysJson { get; set; } = "[]";
    public DateTime CreatedAt { get; set; }

    public SessionEntity? Session { get; set; }
}
