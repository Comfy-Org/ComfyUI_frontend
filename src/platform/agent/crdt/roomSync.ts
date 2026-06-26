/**
 * Room sync protocol (prototype — ADR-0011).
 *
 * Transport-agnostic two-phase Yjs sync, modelled on `y-protocols/sync`:
 *   step 1: a peer announces its state vector
 *   step 2: the other peer replies with the diff that vector is missing
 *   update: incremental updates are broadcast as they happen
 *
 * The transport is injected so this works over the existing Redis→WebSocket
 * bridge in V0 and a dedicated relay later. Updates applied from the transport
 * carry the `REMOTE_ORIGIN` tag so they are not echoed back.
 */
import type { AgentRoom } from './agentRoom'

export type RoomSyncMessage =
  | { type: 'sync-step-1'; workflowId: string; stateVector: Uint8Array }
  | { type: 'sync-step-2'; workflowId: string; update: Uint8Array }
  | { type: 'update'; workflowId: string; update: Uint8Array }

export interface RoomTransport {
  send(message: RoomSyncMessage): void
  onMessage(cb: (message: RoomSyncMessage) => void): () => void
}

const REMOTE_ORIGIN = Symbol('agent-room-remote')

export function syncRoom(
  room: AgentRoom,
  transport: RoomTransport
): () => void {
  const offUpdate = room.onUpdate((update, origin) => {
    if (origin === REMOTE_ORIGIN) return
    transport.send({ type: 'update', workflowId: room.workflowId, update })
  })

  const offMessage = transport.onMessage((message) => {
    if (message.workflowId !== room.workflowId) return
    switch (message.type) {
      case 'sync-step-1':
        transport.send({
          type: 'sync-step-2',
          workflowId: room.workflowId,
          update: room.diffSince(message.stateVector)
        })
        return
      case 'sync-step-2':
      case 'update':
        room.applyRemoteUpdate(message.update, REMOTE_ORIGIN)
        return
    }
  })

  transport.send({
    type: 'sync-step-1',
    workflowId: room.workflowId,
    stateVector: room.encodeStateVector()
  })

  return () => {
    offUpdate()
    offMessage()
  }
}
