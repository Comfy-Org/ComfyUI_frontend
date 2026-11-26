import type { LGraph } from '@/lib/litegraph/src/LGraph'
import { getNodeByExecutionId } from '@/utils/graphTraversalUtil'

import type { NodeHookSource } from '@/platform/nodeApi/v4/defs/dispatchContext'

/** Gives a preview the server sent to the `onPreview` hooks of the node it is for, in any graph of the document. */
export function deliverPreview(
  rootGraph: LGraph,
  executionId: string,
  blob: Blob,
  nodeHooks: NodeHookSource
): void {
  if (nodeHooks.demand('onPreview') === 0) return
  const node = getNodeByExecutionId(rootGraph, executionId)
  if (!node) return
  const frame = Object.freeze({ blob })
  nodeHooks.deliverTo(node, 'onPreview', (callback, handle) =>
    callback(handle, frame)
  )
}
