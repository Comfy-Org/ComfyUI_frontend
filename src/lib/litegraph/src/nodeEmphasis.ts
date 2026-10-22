import type { LGraphNode } from '@/lib/litegraph/src/types/entityRegistry'

type NodeEmphasisQuery = (node: LGraphNode) => boolean

let emphasisQuery: NodeEmphasisQuery | undefined
let emphasisQueryRegistration: symbol | undefined

/**
 * Whether the canvas draws a node with selection emphasis. Without an
 * installed query, only selected nodes are emphasized.
 */
export function isDrawnEmphasized(node: LGraphNode): boolean {
  return emphasisQuery ? emphasisQuery(node) : node.selected
}

/**
 * Installs the app-layer emphasis query. A seam so litegraph never imports
 * the app state that decides emphasis.
 */
export function registerNodeEmphasisQuery(
  query: NodeEmphasisQuery
): () => void {
  if (emphasisQuery && emphasisQuery !== query) {
    console.error('A node emphasis query is already registered')
    return () => {}
  }

  const registration = Symbol()
  emphasisQuery = query
  emphasisQueryRegistration = registration

  return () => {
    if (emphasisQueryRegistration !== registration) return
    emphasisQuery = undefined
    emphasisQueryRegistration = undefined
  }
}
