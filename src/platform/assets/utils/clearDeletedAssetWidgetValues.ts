import type { LGraph, Subgraph } from '@/lib/litegraph/src/litegraph'

import { findNodesReferencingValues } from './clearNodePreviewCacheForValues'

/**
 * Clear widget values that reference deleted assets so the persisted workflow
 * JSON stops claiming the deleted asset is in use.
 *
 * Without this, after `useMediaAssetActions.deleteAssets` succeeds the
 * in-memory preview is cleared (`clearNodePreviewCacheForValues`) but the
 * widget value still points at the deleted asset. On reload the workflow JSON
 * is restored verbatim and `useImageUploadWidget` re-fetches the URL — for
 * output assets the file is still served (history-soft-delete), so the
 * preview re-renders despite the asset being "deleted" everywhere else.
 *
 * Mutates `widget.value` (which `LGraphNode.serialize` re-reads to rebuild
 * `widgets_values`) and invokes `widget.callback` so widgets like Load Image
 * run their own change-handling (clearing `node.imgs`, calling
 * `setNodeOutputs`, etc.).
 *
 * FE-230 — covers the post-reload case without re-introducing
 * useMissingMediaPreviewSync, which couldn't distinguish deletion from
 * verification false-positives (e.g. mask-editor saved values).
 */
export function clearDeletedAssetWidgetValues(
  rootGraph: LGraph | Subgraph,
  deletedValues: ReadonlySet<string>
): void {
  if (deletedValues.size === 0) return
  for (const node of findNodesReferencingValues(rootGraph, deletedValues)) {
    if (!node.widgets) continue
    for (const widget of node.widgets) {
      if (typeof widget.value !== 'string') continue
      if (!deletedValues.has(widget.value)) continue
      widget.value = ''
      widget.callback?.('')
    }
    node.graph?.setDirtyCanvas(true)
  }
}
