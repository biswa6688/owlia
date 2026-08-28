using Microsoft.AspNetCore.SignalR;

namespace Owlia.Host.Hubs;

/// <summary>
/// Central SignalR hub — all streaming events flow through here.
/// Clients join a session group to receive events scoped to that analysis job.
/// </summary>
public class ProgressHub : Hub
{
    // Clients call this to subscribe to a specific session's events.
    public async Task JoinSession(string sessionId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, SessionGroup(sessionId));
    }

    public async Task LeaveSession(string sessionId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, SessionGroup(sessionId));
    }

    public static string SessionGroup(string sessionId) => $"session:{sessionId}";
}
