import * as signalR from '@microsoft/signalr'

let _connection: signalR.HubConnection | null = null

export function getHub(): signalR.HubConnection {
  if (!_connection) {
    _connection = new signalR.HubConnectionBuilder()
      .withUrl('/hub/progress')
      .withAutomaticReconnect()
      .build()
  }
  return _connection
}

export async function startHub(): Promise<signalR.HubConnection> {
  const hub = getHub()
  if (hub.state === signalR.HubConnectionState.Disconnected) {
    await hub.start()
  }
  return hub
}

export async function joinSession(sessionId: string) {
  const hub = await startHub()
  await hub.invoke('JoinSession', sessionId)
  return hub
}

export async function leaveSession(sessionId: string) {
  const hub = getHub()
  if (hub.state === signalR.HubConnectionState.Connected) {
    await hub.invoke('LeaveSession', sessionId)
  }
}
