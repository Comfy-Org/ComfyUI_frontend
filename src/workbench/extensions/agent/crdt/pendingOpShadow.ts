/**
 * Pending-op presentation shadow (s3-opt-5 / CRDT-RM-3): the render-side
 * surface of the follower's optimistic overlay. While a locally minted op is
 * pending (tracked by the s3-opt-1 ledger), this surface remembers WHICH
 * canvas entities — nodes, links, widgets — should render pending/ghost
 * styling, keyed by the op's immutable `op_id` (KA-2).
 *
 * Contract boundaries this module deliberately encodes:
 *
 * - Presentation ONLY. Shadows never touch Yjs, never feed the applier, and
 *   are never encoded as a Yjs update or merged into the shared doc
 *   (KEEP-ALIVE #9, FORECLOSE #5). The module has zero imports.
 * - `show` registers a shadow exactly once per op id — never an overwrite —
 *   mirroring the ledger's enqueue semantics.
 * - `revert(opId)` and `clear(opId)` are the two removal verbs consumed by
 *   s3-opt-2 (failure reconciliation) and s3-opt-3 (KA-9 clear-on-effect).
 *   They mutate identically but emit distinct change events so a renderer can
 *   distinguish "op failed, styling rolls back" from "authoritative effect
 *   landed, pending styling resolves".
 * - `clearAll` drops every shadow: the `doc_reset` and unmount/workflow-switch
 *   path (FEB-5).
 * - Multiple pending ops may shadow the same entity; target pendingness is
 *   refcounted so reverting one op does not unstyle an entity another op
 *   still holds.
 * - Pull-model change notification: subscribers are told THAT the surface
 *   changed (and which verb/op), then re-derive styling via the snapshot
 *   queries. No timers, no clocks, no IO.
 */

/** One canvas entity that renders pending styling while an op is in flight. */
export type ShadowTarget =
  | { readonly kind: 'node'; readonly nodeId: string }
  | { readonly kind: 'link'; readonly linkId: string }
  | {
      readonly kind: 'widget'
      readonly nodeId: string
      readonly widgetName: string
    }

/** The shadow registered for one pending op. */
export interface PendingShadow {
  /** Immutable caller-minted operation id (KA-2). Never regenerated here. */
  readonly opId: string
  readonly targets: readonly ShadowTarget[]
}

/** Why the surface changed; lets renderers animate removal verbs differently. */
export type ShadowChange =
  | { readonly type: 'show'; readonly opId: string }
  | { readonly type: 'revert'; readonly opId: string }
  | { readonly type: 'clear'; readonly opId: string }
  | { readonly type: 'clear-all'; readonly opIds: readonly string[] }

export interface PendingOpShadowSurface {
  /**
   * Register pending styling for a minted op exactly once. Returns false
   * (and changes nothing, notifies nobody) when the op id is already shown.
   */
  show(opId: string, targets: readonly ShadowTarget[]): boolean
  /**
   * Remove a shadow because the op failed or its send was abandoned
   * (s3-opt-2/s3-opt-6 policy). Returns the removed shadow, or undefined
   * (no notification) when the id is not held.
   */
  revert(opId: string): PendingShadow | undefined
  /**
   * Remove a shadow because its authoritative effect arrived — the KA-9
   * clear-on-effect path (s3-opt-3). Returns the removed shadow, or
   * undefined (no notification) when the id is not held.
   */
  clear(opId: string): PendingShadow | undefined
  /**
   * Drop every shadow (doc_reset / unmount / workflow switch, FEB-5).
   * Returns the removed shadows in insertion order; no-op on empty.
   */
  clearAll(): PendingShadow[]
  /** True while at least one pending op shadows this entity. */
  isPending(target: ShadowTarget): boolean
  /** Deduplicated snapshot of every currently shadowed entity. */
  pendingTargets(): ShadowTarget[]
  /** Snapshot of all shadows in insertion order. */
  pendingShadows(): PendingShadow[]
  get(opId: string): PendingShadow | undefined
  size(): number
  /**
   * Observe surface changes. The listener runs synchronously after each
   * mutation that changed state. Returns an unsubscribe function.
   */
  subscribe(listener: (change: ShadowChange) => void): () => void
}

function targetKey(target: ShadowTarget): string {
  switch (target.kind) {
    case 'node':
      return `node:${target.nodeId}`
    case 'link':
      return `link:${target.linkId}`
    case 'widget':
      return `widget:${target.nodeId}:${target.widgetName}`
  }
}

export function createPendingOpShadowSurface(): PendingOpShadowSurface {
  /** Insertion-ordered by show; op ids are never re-minted or reused. */
  const shadows = new Map<string, PendingShadow>()
  /** Refcount of pending ops per target key (several ops may share one). */
  const targetCounts = new Map<string, number>()
  /** First-seen target per key, for deduplicated pendingTargets snapshots. */
  const targetsByKey = new Map<string, ShadowTarget>()
  const listeners = new Set<(change: ShadowChange) => void>()

  const notify = (change: ShadowChange) => {
    for (const listener of listeners) listener(change)
  }

  const retain = (target: ShadowTarget) => {
    const key = targetKey(target)
    const count = targetCounts.get(key) ?? 0
    targetCounts.set(key, count + 1)
    if (count === 0) targetsByKey.set(key, target)
  }

  const release = (target: ShadowTarget) => {
    const key = targetKey(target)
    const count = targetCounts.get(key) ?? 0
    if (count <= 1) {
      targetCounts.delete(key)
      targetsByKey.delete(key)
      return
    }
    targetCounts.set(key, count - 1)
  }

  const remove = (opId: string): PendingShadow | undefined => {
    const shadow = shadows.get(opId)
    if (!shadow) return undefined
    shadows.delete(opId)
    for (const target of shadow.targets) release(target)
    return shadow
  }

  return {
    show(opId, targets) {
      if (shadows.has(opId)) return false
      const shadow: PendingShadow = Object.freeze({
        opId,
        targets: Object.freeze(targets.map((t) => ({ ...t }) as ShadowTarget))
      })
      shadows.set(opId, shadow)
      for (const target of shadow.targets) retain(target)
      notify({ type: 'show', opId })
      return true
    },

    revert(opId) {
      const shadow = remove(opId)
      if (shadow) notify({ type: 'revert', opId })
      return shadow
    },

    clear(opId) {
      const shadow = remove(opId)
      if (shadow) notify({ type: 'clear', opId })
      return shadow
    },

    clearAll() {
      if (shadows.size === 0) return []
      const removed = [...shadows.values()]
      shadows.clear()
      targetCounts.clear()
      targetsByKey.clear()
      notify({ type: 'clear-all', opIds: removed.map((s) => s.opId) })
      return removed
    },

    isPending(target) {
      return targetCounts.has(targetKey(target))
    },

    pendingTargets() {
      return [...targetsByKey.values()]
    },

    pendingShadows() {
      return [...shadows.values()]
    },

    get(opId) {
      return shadows.get(opId)
    },

    size() {
      return shadows.size
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    }
  }
}
