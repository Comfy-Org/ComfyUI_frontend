import type {
  LGraph,
  LGraphNode,
  Subgraph
} from '@/lib/litegraph/src/litegraph'
import { parseAnnotatedPath } from '@/utils/createAnnotatedPath'
import { collectAllNodes } from '@/utils/graphTraversalUtil'

type ReferencePath = ReturnType<typeof parseAnnotatedPath>

const LONGEST_ANNOTATION = '[output]'

function readAnnotationRoot(suffix: string): string | undefined {
  const annotation = suffix.trim()
  if (!annotation || annotation.length > LONGEST_ANNOTATION.length) return
  const { filepath, rootFolder } = parseAnnotatedPath(annotation)
  return filepath ? undefined : rootFolder
}

function referencesPath(value: string, deleted: ReferencePath): boolean {
  if (value === deleted.filepath) {
    const parsed = parseAnnotatedPath(value)
    return (
      parsed.filepath === deleted.filepath &&
      parsed.rootFolder === deleted.rootFolder
    )
  }
  if (!value.startsWith(deleted.filepath) || /\s$/.test(deleted.filepath))
    return false
  return (
    readAnnotationRoot(value.slice(deleted.filepath.length)) ===
    deleted.rootFolder
  )
}

/** Matches widget values naming the same root folder and path as a deleted value. */
export function createDeletedValueMatcher(
  deletedValues: ReadonlySet<string>
): (value: unknown) => boolean {
  const deletedPaths = [...deletedValues].map((value) =>
    parseAnnotatedPath(value)
  )
  return (value) =>
    typeof value === 'string' &&
    deletedPaths.some((deleted) => referencesPath(value, deleted))
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
