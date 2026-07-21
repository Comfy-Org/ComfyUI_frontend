/**
 * Bridges runtime node growth into the layout store.
 *
 * Several popular extensions grow a node *after* it has mounted by writing
 * `node.size[1]` directly (an element mutation) and calling `setDirtyCanvas()`,
 * instead of going through `node.setSize()` / the `set size` setter. On Vue
 * nodes only the `set size` setter mirrors height into `layoutStore`, and Vue
 * nodes read their height from `layoutStore`, so a direct element write leaves
 * the node at its stale height until a manual resize nudges the value back in.
 *
 * Two documented idioms hit this seam:
 *  1. Runtime WIDGET-COUNT growth — `node.addCustomWidget(...)` followed by
 *     `node.size[1] = ...`: rgthree Power Lora Loader, yolain ComfyUI-Easy-Use,
 *     comfyui-0246, ComfyUI-N-Nodes, comfyui-mixlab-nodes and
 *     comfyui-advanced-latent-control (the copy-pasted "not enough space,
 *     increase the size of the node" idiom).
 *  2. IMAGE-PREVIEW growth with NO widget-count change — `img.onload` then
 *     `node.imgs = [...]; node.size[1] = Math.max(200, ...)`: ltdrdata
 *     ComfyUI-Impact-Pack and ComfyUI-N-Nodes.
 *
 * A bare `node.size[1] = h` element write is not observable through Vue
 * reactivity: `_size` is a `TypedArray` view backed by a shared `Rectangle`
 * buffer, so it cannot be wrapped in a reactive proxy, and neither idiom emits
 * a reactive signal (the image-preview idiom does not even touch the widget
 * list). We therefore reconcile each mounted node's real size into
 * `layoutStore` on a single shared animation frame.
 *
 * Loop safety: the reconcile only commits when the node has grown past what
 * `layoutStore` records (`isNodeLarger`), so it is a no-op on every frame
 * except the one where a node actually grew. That growth-only guard also keeps
 * it idempotent with `useLayoutSync` — which writes `layoutStore -> node.size`
 * only on a real delta — so a pending programmatic resize (layout leading,
 * node.size trailing) is never clobbered and no feedback loop is created.
 *
 * TODO(litegraph-stable-resize-api): remove this compensating reflow once
 * litegraph exposes a public resize/commit API that custom nodes call instead
 * of mutating `node.size[1]` directly. See the rgthree reflow blast-radius
 * analysis for the full list of affected packs and both idioms.
 */
import { onScopeDispose } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { LayoutSource } from '@/renderer/core/layout/types'
import type { Size } from '@/renderer/core/layout/types'
import type { NodeId } from '@/types/nodeId'

type GetNode = () => LGraphNode | null | undefined

const targets = new Map<NodeId, GetNode>()
let rafId: number | null = null

function isNodeLarger(current: Size, layout: Size): boolean {
  return current.width > layout.width || current.height > layout.height
}

function reconcile() {
  const { setSource, resizeNode } = useLayoutMutations()

  for (const [nodeId, getNode] of targets) {
    const node = getNode()
    if (!node) continue

    const layout = layoutStore.getNodeLayoutRef(nodeId).value
    if (!layout) continue

    const size = { width: node.size[0], height: node.size[1] }
    if (!isNodeLarger(size, layout.size)) continue

    setSource(LayoutSource.External)
    resizeNode(nodeId, size)
  }
}

function tick() {
  if (!layoutStore.isResizingVueNodes.value) reconcile()
  rafId = targets.size > 0 ? requestAnimationFrame(tick) : null
}

function ensureRunning() {
  if (rafId === null && targets.size > 0) rafId = requestAnimationFrame(tick)
}

export function useRuntimeWidgetReflow(nodeId: NodeId, getNode: GetNode) {
  targets.set(nodeId, getNode)
  ensureRunning()

  onScopeDispose(() => {
    targets.delete(nodeId)
  })
}
