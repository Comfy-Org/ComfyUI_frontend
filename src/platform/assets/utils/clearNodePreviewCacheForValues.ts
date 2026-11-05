import type {
  LGraph,
  LGraphNode,
  Subgraph
} from '@/lib/litegraph/src/litegraph'
import { parseAnnotatedPath } from '@/utils/createAnnotatedPath'
import { collectAllNodes } from '@/utils/graphTraversalUtil'

const LONGEST_ANNOTATION = '[output]'

function readAnnotationRoot(suffix: string): string | undefined {
  const annotation = suffix.trim()
  if (!annotation || annotation.length > LONGEST_ANNOTATION.length) return
  const { filepath, rootFolder } = parseAnnotatedPath(annotation)
  return filepath ? undefined : rootFolder
}

function indexRootsByPath(deletedValues: ReadonlySet<string>) {
  const rootsByPath = new Map<string, Set<string>>()
  for (const value of deletedValues) {
    const { filepath, rootFolder } = parseAnnotatedPath(value)
    if (!filepath) continue
    const roots = rootsByPath.get(filepath) ?? new Set<string>()
    rootsByPath.set(filepath, roots.add(rootFolder))
  }
  return rootsByPath
}

/** Matches widget values naming the same root folder and path as a deleted value. */
export function createDeletedValueMatcher(
  deletedValues: ReadonlySet<string>
): (value: unknown) => boolean {
  const rootsByPath = indexRootsByPath(deletedValues)
  const hasRoot = (filepath: string, rootFolder: string | undefined) =>
    rootFolder !== undefined && !!rootsByPath.get(filepath)?.has(rootFolder)

  return (value) => {
    if (typeof value !== 'string') return false
    if (rootsByPath.has(value)) {
      const parsed = parseAnnotatedPath(value)
      if (hasRoot(parsed.filepath, parsed.rootFolder)) return true
    }
    const annotationStart = value.trimEnd().lastIndexOf('[')
    if (annotationStart < 0) return false
    const filepath = value.slice(0, annotationStart).trimEnd()
    return hasRoot(filepath, readAnnotationRoot(value.slice(filepath.length)))
  }
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
