import type { Op } from '@comfyorg/comfy-multi-player'

import type { DocUpdate } from './docFrameClient'

/**
 * Presentation-only optimistic-effect ledger. It never receives a Y.Doc and
 * therefore cannot mutate or merge into the authoritative document (KA-9).
 */
export class PendingEffects {
  private readonly opIds = new Set<string>()

  add(ops: readonly Op[]): void {
    for (const op of ops) this.opIds.add(op.op_id)
  }

  /**
   * Clear only identities whose EFFECT arrived in a host doc update. A
   * doc_ops_result acknowledgement deliberately never calls this method.
   * Returns true when the whole frame is our own echoed effect.
   */
  observe(update: DocUpdate, selfActor: string): boolean {
    const ids = update.opIds ?? []
    const selfEcho =
      update.actor === selfActor &&
      ids.length > 0 &&
      ids.every((opId) => this.opIds.has(opId))
    for (const opId of ids) this.opIds.delete(opId)
    return selfEcho
  }

  has(opId: string): boolean {
    return this.opIds.has(opId)
  }

  get size(): number {
    return this.opIds.size
  }

  clear(): void {
    this.opIds.clear()
  }
}
