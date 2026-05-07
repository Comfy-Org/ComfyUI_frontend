import { watch } from 'vue'

import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { useMissingMediaStore } from '@/platform/missingMedia/missingMediaStore'
import { app } from '@/scripts/app'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { getNodeByExecutionId } from '@/utils/graphTraversalUtil'

/**
 * FE-230 — When the missing-media pipeline confirms that a node references a
 * deleted asset (e.g. a workflow loaded after the user deleted an Input/Output
 * asset), clear that node's preview cache so the Load Image / Load Video node
 * does not keep displaying a thumbnail for the deleted file.
 *
 * The deletion handler (`useMediaAssetActions.deleteAssets`) already clears
 * previews for the live case; this composable covers the workflow-open case
 * where the deletion happened in a previous session and the saved widget
 * value still references the deleted file.
 */
export function useMissingMediaPreviewSync(
  missingMediaStore: ReturnType<typeof useMissingMediaStore>
): () => void {
  const nodeOutputStore = useNodeOutputStore()

  function clearPreviewForNode(node: LGraphNode): void {
    nodeOutputStore.removeNodeOutputs(node.id)
    node.imgs = undefined
    node.videoContainer = undefined
    node.graph?.setDirtyCanvas(true)
  }

  const stop = watch(
    () => missingMediaStore.missingMediaCandidates,
    (candidates) => {
      if (!candidates?.length || !app.isGraphReady) return
      const rootGraph = app.rootGraph as LGraph | undefined
      if (!rootGraph) return

      const cleared = new Set<number | string>()
      for (const candidate of candidates) {
        const node = getNodeByExecutionId(rootGraph, String(candidate.nodeId))
        if (!node || cleared.has(node.id)) continue
        cleared.add(node.id)
        clearPreviewForNode(node)
      }
    },
    { flush: 'post' }
  )

  return stop
}
