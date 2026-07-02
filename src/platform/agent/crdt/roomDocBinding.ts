/**
 * Binds an agent room to a Yjs document (prototype — ADR-0011).
 *
 * Generic, layer-safe core of the canvas binding: it works on any `Y.Doc`, so
 * it stays in the platform layer with no renderer dependency. The renderer-layer
 * wrapper (`renderer/core/layout/agent/bindRoomToLayoutStore.ts`) supplies the
 * live layout store's doc. Bidirectional Yjs sync with origin tags prevents echo
 * loops; Yjs reconciles concurrent edits.
 */
import * as Y from 'yjs'

import type { AgentRoom } from './agentRoom'

const AGENT_ORIGIN = Symbol('agent-room->doc')
const DOC_ORIGIN = Symbol('doc->agent-room')

export function bindRoomToDoc(room: AgentRoom, doc: Y.Doc): () => void {
  Y.applyUpdate(room.doc, Y.encodeStateAsUpdate(doc), DOC_ORIGIN)
  Y.applyUpdate(doc, Y.encodeStateAsUpdate(room.doc), AGENT_ORIGIN)

  const onRoom = (update: Uint8Array, origin: unknown) => {
    if (origin !== DOC_ORIGIN) Y.applyUpdate(doc, update, AGENT_ORIGIN)
  }
  const onDoc = (update: Uint8Array, origin: unknown) => {
    if (origin !== AGENT_ORIGIN) Y.applyUpdate(room.doc, update, DOC_ORIGIN)
  }

  room.doc.on('update', onRoom)
  doc.on('update', onDoc)

  return () => {
    room.doc.off('update', onRoom)
    doc.off('update', onDoc)
  }
}
