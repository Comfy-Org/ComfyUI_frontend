import type {
  LGraph,
  LGraphNode,
  Subgraph
} from '@/lib/litegraph/src/litegraph'
import { parseAnnotatedPath } from '@/utils/createAnnotatedPath'
import { collectAllNodes } from '@/utils/graphTraversalUtil'

function toReferenceKey(value: string): string {
  const { filepath, rootFolder } = parseAnnotatedPath(value)
  return JSON.stringify([rootFolder, filepath])
}

/** Matches widget values naming the same root folder and path as a deleted value. */
export function createDeletedValueMatcher(
  deletedValues: ReadonlySet<string>
): (value: unknown) => boolean {
  const deletedKeys = new Set([...deletedValues].map(toReferenceKey))
  return (value) =>
    typeof value === 'string' && deletedKeys.has(toReferenceKey(value))
}

/** Clears the canvas and Vue preview state of every node referencing a deleted value. */
export function clearNodePreviewCacheForValues(
  rootGraph: LGraph | Subgraph,
  deletedValues: ReadonlySet<string>,
  removeOutputsForNode: (node: LGraphNode) => void
): void {
  if (deletedValues.size === 0) return
  for (const node of findNodesReferencingValues(rootGraph, deletedValues)) {
    removeOutputsForNode(node)
    node.imgs = undefined
    node.videoContainer = undefined
    node.graph?.setDirtyCanvas(true)
  }
}

/** Nodes, including subgraph interiors, whose widgets reference a deleted value. */
export function findNodesReferencingValues(
  rootGraph: LGraph | Subgraph,
  deletedValues: ReadonlySet<string>,
  { includeSubgraphNodes = false }: { includeSubgraphNodes?: boolean } = {}
): LGraphNode[] {
  if (deletedValues.size === 0) return []
  const isDeleted = createDeletedValueMatcher(deletedValues)
  const matches: LGraphNode[] = []
  for (const node of collectAllNodes(rootGraph)) {
    if (!node.widgets?.length) continue
    if (
      !includeSubgraphNodes &&
      typeof node.isSubgraphNode === 'function' &&
      node.isSubgraphNode()
    )
      continue
    if (node.widgets.some((w) => isDeleted(w.value))) matches.push(node)
  }
  return matches
}
