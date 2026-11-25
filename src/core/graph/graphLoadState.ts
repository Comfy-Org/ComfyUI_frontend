import type { LGraph } from '@/lib/litegraph/src/litegraph'

const loadingGraphs = new WeakSet<LGraph>()
const graphLoadGenerations = new WeakMap<LGraph, number>()

/** Marks `graph` as being configured by a workflow load until `endGraphLoad`. */
export function beginGraphLoad(graph: LGraph): void {
  loadingGraphs.add(graph)
  graphLoadGenerations.set(graph, getGraphLoadGeneration(graph) + 1)
}

export function endGraphLoad(graph: LGraph): void {
  loadingGraphs.delete(graph)
}

/** Whether a workflow load is configuring `graph`; listeners skip capture and scans while it is. */
export function isGraphLoading(graph: LGraph | null | undefined): boolean {
  return graph != null && loadingGraphs.has(graph)
}

/** Increments each time `graph` begins a load; detects in-place reconfiguration of the same object. */
export function getGraphLoadGeneration(graph: LGraph): number {
  return graphLoadGenerations.get(graph) ?? 0
}
