import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'

/**
 * Clear cached Load Image preview state for nodes whose widget value matches
 * a deleted asset filename. See FE-230.
 *
 * This is a stub — the behavior is implemented in the follow-up fix commit so
 * the accompanying test can prove it catches the bug.
 */
export function clearNodePreviewCacheForFilenames(
  _graph: LGraph,
  _deletedFilenames: ReadonlySet<string>,
  _nodeToLocatorId: (node: LGraphNode) => string | null
): void {}
