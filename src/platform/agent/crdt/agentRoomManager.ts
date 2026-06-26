/**
 * Agent room manager (prototype — ADR-0011).
 *
 * Owns room lifecycle. A tab switch is a `join`/`leave`; a room stays alive in
 * memory while any tab references it, so the agent can keep applying edits to a
 * backgrounded workflow and the user sees them lazily on return (the scenario
 * from the design meeting). `pin` keeps a room alive with zero open tabs while
 * the agent is mid-edit; the room is torn down only when unreferenced and
 * unpinned.
 */
import { AgentRoom } from './agentRoom'
import type { WorkflowId } from './agentRoom'

interface RoomEntry {
  room: AgentRoom
  refs: number
  pinned: boolean
}

export class AgentRoomManager {
  private readonly entries = new Map<WorkflowId, RoomEntry>()

  join(workflowId: WorkflowId): AgentRoom {
    const existing = this.entries.get(workflowId)
    if (existing) {
      existing.refs += 1
      return existing.room
    }
    const room = new AgentRoom(workflowId)
    this.entries.set(workflowId, { room, refs: 1, pinned: false })
    return room
  }

  leave(workflowId: WorkflowId): void {
    const entry = this.entries.get(workflowId)
    if (!entry) return
    entry.refs = Math.max(0, entry.refs - 1)
    this.reapIfIdle(workflowId, entry)
  }

  pin(workflowId: WorkflowId): void {
    const entry = this.entries.get(workflowId)
    if (entry) entry.pinned = true
  }

  unpin(workflowId: WorkflowId): void {
    const entry = this.entries.get(workflowId)
    if (!entry) return
    entry.pinned = false
    this.reapIfIdle(workflowId, entry)
  }

  get(workflowId: WorkflowId): AgentRoom | undefined {
    return this.entries.get(workflowId)?.room
  }

  has(workflowId: WorkflowId): boolean {
    return this.entries.has(workflowId)
  }

  get size(): number {
    return this.entries.size
  }

  private reapIfIdle(workflowId: WorkflowId, entry: RoomEntry): void {
    if (entry.refs === 0 && !entry.pinned) {
      entry.room.destroy()
      this.entries.delete(workflowId)
    }
  }
}
