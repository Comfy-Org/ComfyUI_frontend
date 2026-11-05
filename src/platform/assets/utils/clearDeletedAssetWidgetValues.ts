import type { LGraph, Subgraph } from '@/lib/litegraph/src/litegraph'

import {
  createDeletedValueMatcher,
  findNodesReferencingValues
} from './clearNodePreviewCacheForValues'

/** Blanks widget values referencing deleted assets so the saved workflow drops them. */
export function clearDeletedAssetWidgetValues(
  rootGraph: LGraph | Subgraph,
  deletedValues: ReadonlySet<string>
): void {
  if (deletedValues.size === 0) return
  const isDeleted = createDeletedValueMatcher(deletedValues)
  for (const node of findNodesReferencingValues(rootGraph, deletedValues, {
    includeSubgraphNodes: true
  })) {
    if (!node.widgets) continue
    for (const widget of node.widgets) {
      if (!isDeleted(widget.value)) continue
      widget.value = ''
      widget.callback?.('')
    }
    node.graph?.setDirtyCanvas(true)
  }
}
