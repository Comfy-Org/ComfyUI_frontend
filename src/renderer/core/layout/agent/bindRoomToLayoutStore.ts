/**
 * Wires an agent room to the live layout store (prototype — ADR-0011).
 *
 * The renderer-layer entry point: it owns the dependency on the layout store
 * singleton (platform code may not import renderer) and delegates the actual
 * sync to the generic, layer-safe `bindRoomToDoc`. This is the "few lines"
 * the design meeting referenced — the store already exposes the Yjs peer
 * surface (`getYDoc`, marked "future feature") and the agent is that peer.
 */
import type { AgentRoom } from '@/platform/agent/crdt/agentRoom'
import { bindRoomToDoc } from '@/platform/agent/crdt/roomDocBinding'

import { layoutStore } from '@/renderer/core/layout/store/layoutStore'

export function bindRoomToLayoutStore(room: AgentRoom): () => void {
  return bindRoomToDoc(room, layoutStore.getYDoc())
}
