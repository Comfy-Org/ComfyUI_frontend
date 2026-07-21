/**
 * Bridges runtime widget growth into the layout store.
 *
 * Extensions such as rgthree's Power Lora Loader add rows after the node has
 * mounted (`node.addCustomWidget(...)`) and then set `node.size[1]` directly.
 * A direct element mutation skips the `set size` setter, which is the only path
 * that mirrors a node's height into `layoutStore`. Vue nodes take their height
 * from `layoutStore`, so the node keeps its stale height until a manual resize
 * nudges the value back in.
 *
 * Watching the widget count and re-committing `node.size` on change closes that
 * seam without depending on the ResizeObserver commit timing. The commit is a
 * no-op when the size already matches, so a widget mutation that did not change
 * the node height never emits a spurious layout change.
 */
import { watch } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { LayoutSource } from '@/renderer/core/layout/types'
import { isSizeEqual } from '@/renderer/core/layout/utils/geometry'
import type { NodeId } from '@/types/nodeId'

export function useRuntimeWidgetReflow(
  nodeId: NodeId,
  getNode: () => LGraphNode | null | undefined,
  getWidgetCount: () => number
) {
  const { setSource, resizeNode } = useLayoutMutations()

  watch(getWidgetCount, () => {
    const node = getNode()
    if (!node) return

    const layout = layoutStore.getNodeLayoutRef(nodeId).value
    if (!layout) return

    const size = { width: node.size[0], height: node.size[1] }
    if (isSizeEqual(layout.size, size)) return

    setSource(LayoutSource.External)
    resizeNode(nodeId, size)
  })
}
