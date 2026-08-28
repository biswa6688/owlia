import * as signalR from '@microsoft/signalr'

// In dev (npm run dev): Vite proxies /hub → backend, so relative URL works.
// In prod (served by Kestrel): same origin, relative URL also works.
// Either way we always use '/hub/progress' — the proxy handles the rest.
const HUB_URL = '/hub/progress'

let _connection: signalR.HubConnection | null = null

export function getHub(): signalR.HubConnection {
  if (!_connection) {
    _connection = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL)
      .withAutomaticReconnect([0, 1000, 2000, 5000]) // retry delays in ms
      .configureLogging(signalR.LogLevel.Warning)     // suppress Info noise in console
      .build()
  }
  return _connection
}

export async function startHub(): Promise<signalR.HubConnection> {
  const hub = getHub()
  if (hub.state === signalR.HubConnectionState.Disconnected) {
    try {
      await hub.start()
    } catch (err) {
      // Don't crash the UI if SignalR can't connect — features just won't stream
      console.warn('[SignalR] Could not connect to hub:', err)
    }
  }
  return hub
}

export async function joinSession(sessionId: string) {
  const hub = await startHub()
  if (hub.state === signalR.HubConnectionState.Connected) {
    await hub.invoke('JoinSession', sessionId)
  }
  return hub
}

export async function leaveSession(sessionId: string) {
  const hub = getHub()
  if (hub.state === signalR.HubConnectionState.Connected) {
    try { await hub.invoke('LeaveSession', sessionId) } catch { /* ignore */ }
  }
}
