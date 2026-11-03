import { isEqual } from 'es-toolkit'

import type { GraphOperation } from './graphOperations'

type SetWidgetOp = Extract<GraphOperation, { op: 'set_widget' }>

/**
 * Widget registers the live graph has written but the document has not yet
 * caught up on. A register is one last-writer-wins value: a remote frame that
 * writes it while a local write is still in flight holds the value the host
 * built before that write reached it, so applying the frame would rewind the
 * widget and lose what was typed since. Such a frame is held back until the
 * document holds the local value, or the write settles without reaching the
 * document (host skipped or refused it, lineage broke).
 *
 * Only the latest local value per register is kept: an older in-flight write
 * settling (its echo, its ack) does not lift the hold while a newer one is
 * still out. Interior (`path`) writes address subgraph definitions the applier
 * never projects, so they are not tracked.
 */
export class LocalWidgetWrites {
  private readonly pending = new Map<string, unknown>()

  note(operations: readonly GraphOperation[]): void {
    for (const op of topLevelSetWidgetOps(operations)) {
      this.pending.set(registerKey(op.node_id, op.widget), op.value)
    }
  }

  /** Lifts the hold of every register whose settled op carried its latest value. */
  settle(operations: readonly GraphOperation[]): void {
    for (const op of topLevelSetWidgetOps(operations)) {
      this.holds(String(op.node_id), op.widget, op.value)
    }
  }

  /** Lifts the hold of every register the document has caught up on. */
  settleAgainst(docValue: (nodeId: string, widget: string) => unknown): void {
    for (const key of Array.from(this.pending.keys())) {
      const [nodeId, widget] = splitKey(key)
      this.holds(nodeId, widget, docValue(nodeId, widget))
    }
  }

  /**
   * True while a local write to the register is in flight and `docValue` is
   * not it. A matching value settles the write and lets the frame through.
   */
  holds(nodeId: string, widget: string, docValue: unknown): boolean {
    const key = registerKey(nodeId, widget)
    if (!this.pending.has(key)) return false
    if (!isEqual(this.pending.get(key), docValue)) return true
    this.pending.delete(key)
    return false
  }

  clear(): void {
    this.pending.clear()
  }
}

function topLevelSetWidgetOps(
  operations: readonly GraphOperation[]
): SetWidgetOp[] {
  return operations.filter(
    (op): op is SetWidgetOp => op.op === 'set_widget' && op.path == null
  )
}

const KEY_SEPARATOR = '\u0000'

function registerKey(nodeId: string | number, widget: string): string {
  return `${String(nodeId)}${KEY_SEPARATOR}${widget}`
}

function splitKey(key: string): [nodeId: string, widget: string] {
  const at = key.indexOf(KEY_SEPARATOR)
  return [key.slice(0, at), key.slice(at + KEY_SEPARATOR.length)]
}
