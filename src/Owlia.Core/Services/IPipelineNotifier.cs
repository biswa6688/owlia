namespace Owlia.Core.Services;

/// <summary>
/// Abstraction over SignalR hub — AI project sends progress without knowing about SignalR/Hub types.
/// </summary>
public interface IPipelineNotifier
{
    Task ProgressAsync(string sessionId, string stage, int percent);
    Task SegmentAsync(string sessionId, object segment);
    Task CompleteAsync(string sessionId);
    Task ErrorAsync(string sessionId, string error);
}
