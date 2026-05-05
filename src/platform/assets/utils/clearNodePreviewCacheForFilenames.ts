import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'

const ANNOTATION_PATTERN = / \[(input|output|temp)\]$/i

export const extractFilenameFromWidgetValue = (
  value: unknown
): string | null => {
  if (typeof value === 'string') {
    const withoutAnnotation = value.replace(ANNOTATION_PATTERN, '')
    const slashIndex = withoutAnnotation.lastIndexOf('/')
    return slashIndex === -1
      ? withoutAnnotation
      : withoutAnnotation.slice(slashIndex + 1)
  }
  if (value && typeof value === 'object' && 'filename' in value) {
    const filename = (value as { filename: unknown }).filename
    return typeof filename === 'string' ? filename : null
  }
  return null
}

/**
 * Clear cached Load Image / Load Video preview state on any node whose widget
 * value references one of the given filenames. Covers:
 *   - the canvas renderer cache (`node.imgs`, `node.videoContainer`)
 *   - the Vue preview source — must be cleared via `removeOutputsForNode`
 *     so the Pinia reactive ref (`nodeOutputStore.nodeOutputs.value`) updates,
 *     not just the legacy `app.nodeOutputs` mirror
 *
 * Widget values from `createAnnotatedPath` may include a `subfolder/` prefix
 * and a ` [output|input|temp]` suffix; strip both before comparing so the
 * matcher fires for output assets and assets stored in subfolders.
 *
 * FE-230 — invoked after successful asset deletion so the Load Image / Load
 * Video node preview does not keep displaying a thumbnail for an asset that
 * no longer exists.
 */
export function clearNodePreviewCacheForFilenames(
  graph: LGraph,
  deletedFilenames: ReadonlySet<string>,
  removeOutputsForNode: (node: LGraphNode) => void
): void {
  if (deletedFilenames.size === 0) return
  for (const node of findNodesReferencingFilenames(graph, deletedFilenames)) {
    removeOutputsForNode(node)
    node.imgs = undefined
    node.videoContainer = undefined
    node.graph?.setDirtyCanvas(true)
  }
}

/**
 * Iterate `graph._nodes` and yield each node whose widget value references one
 * of `deletedFilenames` (after stripping subfolder prefix and `[input|output|
 * temp]` annotation). Used by both the preview-clearing path and the
 * missing-media-marking path so the two stay in lockstep.
 */
export function findNodesReferencingFilenames(
  graph: LGraph,
  deletedFilenames: ReadonlySet<string>
): LGraphNode[] {
  if (deletedFilenames.size === 0) return []
  const matches: LGraphNode[] = []
  const nodes = graph._nodes ?? []
  for (const node of nodes) {
    const referencesDeleted = node.widgets?.some((w) => {
      const filename = extractFilenameFromWidgetValue(w.value)
      return filename !== null && deletedFilenames.has(filename)
    })
    if (referencesDeleted) matches.push(node)
  }
  return matches
}
