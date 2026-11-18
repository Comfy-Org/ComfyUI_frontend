import type { LGraph } from '@/lib/litegraph/src/LGraph'

import { currentDocumentGeneration } from './appReady'

/**
 * Follows a graph by id under its root, so it survives undo and redo, which
 * rebuild subgraphs. Resolves to undefined once another document loads.
 */
export function followGraph(graph: LGraph): () => LGraph | undefined {
  const generation = currentDocumentGeneration()
  const root = new WeakRef(graph.rootGraph)
  const { id } = graph
  return () => {
    if (currentDocumentGeneration() !== generation) return undefined
    const live = root.deref()
    return live?.id === id ? live : live?.subgraphs.get(id)
  }
}
