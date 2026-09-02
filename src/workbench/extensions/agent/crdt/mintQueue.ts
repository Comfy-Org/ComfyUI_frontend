/**
 * The single ordered outbox behind the three mint ports.
 *
 * Each port mints on its own clock: the link and widget feeds fire
 * synchronously inside the store action, while the layout store delivers a
 * whole task's changes on ONE microtask. Raw mint order across ports is
 * therefore NOT causal order - a same-task `createNode` + `registerLink`
 * mints its connect before its add_node. Rather than racing per-port
 * microtasks against the store's, every port enqueues here and one drain
 * (a double microtask from the first enqueue: strictly after the layout
 * store's flush and the link port's placement flush, both single-microtask)
 * emits the task's ops in dependency order:
 *
 *   1. structural ops (add_node / delete_node / clear) in layout-store order,
 *      which IS causal for that class (one store, one queue);
 *   2. connect / set_widget in mint order (synchronous feeds, causal within
 *      the class), which can only depend on nodes rule 1 already placed.
 *
 * A connect or top-level set_widget naming a node that the same drain
 * deletes (delete_node, or a clear's removed_nodes) and does not re-add is
 * dropped: rule 1 would land it after the delete, and the local graph
 * already lacks the node, so doc and graph agree without it - the same
 * argument as the link port's cancelPlacement. Interior set_widget (carries
 * `path`) addresses a subgraph definition, not a root node, and is never
 * pruned.
 */
import type { GraphOperation } from './graphOperations'

export interface MintQueue {
  /** Port-facing inbox; the drain is scheduled by the first call of a task. */
  enqueue(operations: GraphOperation[]): void
  /** Deliver everything queued right now (the detach path). */
  flush(): void
}

type StructuralOperation = Extract<
  GraphOperation,
  { op: 'add_node' | 'delete_node' | 'clear' }
>

function isStructural(
  operation: GraphOperation
): operation is StructuralOperation {
  return (
    operation.op === 'add_node' ||
    operation.op === 'delete_node' ||
    operation.op === 'clear'
  )
}

/** Pure ordering + pruning of one drain's worth of minted operations. */
export function orderMintedOperations(
  operations: GraphOperation[]
): GraphOperation[] {
  const structural = operations.filter(isStructural)
  const dependent = operations.filter((operation) => !isStructural(operation))
  const added = new Set<string>()
  const removed = new Set<string>()
  for (const operation of structural) {
    if (operation.op === 'add_node') added.add(String(operation.node_id))
    else if (operation.op === 'delete_node')
      removed.add(String(operation.node_id))
    else for (const id of operation.removed_nodes) removed.add(String(id))
  }
  const gone = (nodeId: string | number): boolean => {
    const key = String(nodeId)
    return removed.has(key) && !added.has(key)
  }
  const kept = dependent.filter((operation) => {
    if (operation.op === 'connect') {
      return !gone(operation.from_node) && !gone(operation.to_node)
    }
    if (operation.op === 'set_widget' && operation.path == null) {
      return !gone(operation.node_id)
    }
    return true
  })
  return [...structural, ...kept]
}

export function createMintQueue(
  deliver: (operations: GraphOperation[]) => void
): MintQueue {
  let queued: GraphOperation[] = []
  let drainScheduled = false

  function drain(): void {
    drainScheduled = false
    if (queued.length === 0) return
    const batch = queued
    queued = []
    const ordered = orderMintedOperations(batch)
    if (ordered.length > 0) deliver(ordered)
  }

  return {
    enqueue(operations) {
      if (operations.length === 0) return
      queued.push(...operations)
      if (drainScheduled) return
      drainScheduled = true
      // Double microtask: the layout store flushes on one, the link port's
      // placement window closes on one; this drain must see both.
      queueMicrotask(() => queueMicrotask(drain))
    },
    flush() {
      drain()
    }
  }
}
