import type { LGraph } from '@/lib/litegraph/src/litegraph'

const loadingGraphs = new WeakSet<LGraph>()

/** Marks `graph` as being configured by a workflow load until `endGraphLoad`. */
export function beginGraphLoad(graph: LGraph): void {
  loadingGraphs.add(graph)
}

export function endGraphLoad(graph: LGraph): void {
  loadingGraphs.delete(graph)
}

/** Whether a workflow load is configuring `graph`; listeners skip capture and scans while it is. */
export function isGraphLoading(graph: LGraph | null | undefined): boolean {
  return graph != null && loadingGraphs.has(graph)
}
