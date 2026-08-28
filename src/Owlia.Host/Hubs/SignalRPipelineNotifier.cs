using Microsoft.AspNetCore.SignalR;
using Owlia.Core.Services;

namespace Owlia.Host.Hubs;

/// <summary>
/// Routes AI pipeline events to the correct SignalR session group.
/// Registered as singleton in DI; AI project only sees IPipelineNotifier.
/// </summary>
public sealed class SignalRPipelineNotifier : IPipelineNotifier
{
    private readonly IHubContext<ProgressHub> _hub;

    public SignalRPipelineNotifier(IHubContext<ProgressHub> hub)
    {
        _hub = hub;
    }

    public Task ProgressAsync(string sessionId, string stage, int percent) =>
        _hub.Clients.Group(ProgressHub.SessionGroup(sessionId))
            .SendAsync("AnalysisProgress", new { stage, percent });

    public Task SegmentAsync(string sessionId, object segment) =>
        _hub.Clients.Group(ProgressHub.SessionGroup(sessionId))
            .SendAsync("TranscriptSegment", segment);

    public Task CompleteAsync(string sessionId) =>
        _hub.Clients.Group(ProgressHub.SessionGroup(sessionId))
            .SendAsync("AnalysisComplete", new { sessionId });

    public Task ErrorAsync(string sessionId, string error) =>
        _hub.Clients.Group(ProgressHub.SessionGroup(sessionId))
            .SendAsync("AnalysisError", new { error });
}
