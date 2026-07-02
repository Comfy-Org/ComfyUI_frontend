/**
 * Agent CRDT room (prototype — ADR-0011, building on ADR-0003).
 *
 * One collaborative workflow = one room: a thin wrapper over a Yjs `Y.Doc` that
 * the browser and the server-side agent share. The agent is the first
 * multiplayer peer. Top-level types (`nodes`/`links`/`reroutes`) mirror the live
 * layout store so a room can drive the real canvas via binary updates
 * (see `layoutStoreBinding.ts`). Conflict resolution is Yjs's job — no version
 * CAS at this layer.
 */
import * as Y from 'yjs'

export type WorkflowId = string
export type ActorId = string
export type UpdateOrigin = unknown

export interface RoomPresence {
  actor: ActorId
  kind: 'user' | 'agent'
  status: 'idle' | 'editing'
  focus: string[]
  updatedAt: number
}

const PRESENCE_KEY = '__presence'

export class AgentRoom {
  readonly workflowId: WorkflowId
  readonly doc: Y.Doc
  readonly nodes: Y.Map<unknown>
  readonly links: Y.Map<unknown>
  readonly reroutes: Y.Map<unknown>

  private readonly presence: Y.Map<RoomPresence>

  constructor(workflowId: WorkflowId, doc: Y.Doc = new Y.Doc()) {
    this.workflowId = workflowId
    this.doc = doc
    this.nodes = doc.getMap('nodes')
    this.links = doc.getMap('links')
    this.reroutes = doc.getMap('reroutes')
    this.presence = doc.getMap(PRESENCE_KEY)
  }

  /** State vector describing what this peer already has (sync step 1). */
  encodeStateVector(): Uint8Array {
    return Y.encodeStateVector(this.doc)
  }

  /** Minimal update a peer needs given its state vector (sync step 2). */
  diffSince(remoteStateVector: Uint8Array): Uint8Array {
    return Y.encodeStateAsUpdate(this.doc, remoteStateVector)
  }

  /** Full state as a single update, used to seed a fresh peer. */
  encodeState(): Uint8Array {
    return Y.encodeStateAsUpdate(this.doc)
  }

  applyRemoteUpdate(update: Uint8Array, origin?: UpdateOrigin): void {
    Y.applyUpdate(this.doc, update, origin)
  }

  onUpdate(cb: (update: Uint8Array, origin: UpdateOrigin) => void): () => void {
    const handler = (update: Uint8Array, origin: UpdateOrigin) =>
      cb(update, origin)
    this.doc.on('update', handler)
    return () => this.doc.off('update', handler)
  }

  setPresence(p: RoomPresence): void {
    this.presence.set(p.actor, p)
  }

  clearPresence(actor: ActorId): void {
    this.presence.delete(actor)
  }

  getPresence(): RoomPresence[] {
    return [...this.presence.values()]
  }

  isAgentEditing(): boolean {
    return this.getPresence().some(
      (p) => p.kind === 'agent' && p.status === 'editing'
    )
  }

  onPresenceChange(cb: (presence: RoomPresence[]) => void): () => void {
    const handler = () => cb(this.getPresence())
    this.presence.observe(handler)
    return () => this.presence.unobserve(handler)
  }

  destroy(): void {
    this.doc.destroy()
  }
}
