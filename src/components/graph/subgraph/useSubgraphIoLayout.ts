import {
  computedWithControl,
  useElementSize,
  useResizeObserver
} from '@vueuse/core'
import { computed, shallowRef, watch } from 'vue'
import type { Ref } from 'vue'

import { onCanvasFrame } from '@/lib/litegraph/src/canvas/canvasFrame'
import type { SubgraphInputNode } from '@/lib/litegraph/src/subgraph/SubgraphInputNode'
import type { SubgraphOutputNode } from '@/lib/litegraph/src/subgraph/SubgraphOutputNode'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useSubgraphIoLayoutStore } from '@/renderer/core/layout/store/subgraphIoLayoutStore'
import { MIN_NODE_WIDTH } from '@/renderer/core/layout/transform/graphRenderTransform'
import { useTransformState } from '@/renderer/core/layout/transform/useTransformState'
import { useNodeResize } from '@/renderer/extensions/vueNodes/interactions/resize/useNodeResize'

type SubgraphIoNode = SubgraphInputNode | SubgraphOutputNode

export function useSubgraphIoLayout(
  ioNode: () => SubgraphIoNode | undefined,
  element: Readonly<Ref<HTMLElement | null>>,
  slotCount: () => number,
  collapsed: () => boolean
) {
  const canvasStore = useCanvasStore()
  const layout = useSubgraphIoLayoutStore()
  const { camera, syncWithCanvas } = useTransformState()
  const { width, height } = useElementSize(element, undefined, {
    box: 'border-box'
  })
  const size = computedWithControl(ioNode, () => {
    const bounds = ioNode()?.asSerialisable().bounding
    return {
      width: Math.max(MIN_NODE_WIDTH, bounds?.[2] ?? 0),
      height: bounds?.[3] ?? 0
    }
  })
  const style = computed(() => ({
    '--node-width': `${size.value.width}px`,
    '--node-height': collapsed() ? '0px' : `${size.value.height}px`,
    '--min-node-width': `${MIN_NODE_WIDTH}px`
  }))

  const rows = shallowRef<HTMLElement[]>([])
  const slotCenters = shallowRef<number[]>([])
  function measureSlotCenters() {
    const panel = element.value
    if (!panel?.offsetHeight) return
    const panelRect = panel.getBoundingClientRect()
    const scale = panelRect.height / panel.offsetHeight
    slotCenters.value = rows.value.map((row) => {
      const port = row.querySelector('[data-port-anchor]') ?? row
      const rect = port.getBoundingClientRect()
      return (rect.top + rect.height / 2 - panelRect.top) / scale
    })
  }
  useResizeObserver(() => [element.value, ...rows.value], measureSlotCenters)
  watch(
    [element, slotCount, collapsed],
    () => {
      rows.value = [
        ...(element.value?.querySelectorAll<HTMLElement>(
          '[data-subgraph-port]'
        ) ?? [])
      ]
      measureSlotCenters()
    },
    { flush: 'post', immediate: true }
  )

  watch(
    [ioNode, () => canvasStore.linearMode, width, height, slotCenters],
    ([node], __, onCleanup) => {
      if (!node || canvasStore.linearMode) return
      const graphId = node.subgraph.id
      layout.report(graphId, node.id, {
        width: width.value || size.value.width,
        height: height.value || size.value.height,
        slotCenters: slotCenters.value
      })
      canvasStore.canvas?.setDirty(true, true)
      onCleanup(() => {
        layout.clear(graphId, node.id)
        canvasStore.canvas?.setDirty(true, true)
      })
    },
    { flush: 'sync', immediate: true }
  )

  watch(
    [ioNode, () => canvasStore.canvas],
    ([node, canvas], _, onCleanup) => {
      if (!node || !canvas) return
      onCleanup(
        onCanvasFrame(canvas.canvas, 'present', () => {
          const current = element.value
          if (!current) return
          syncWithCanvas(canvas)
          const [x, y] = node.boundingRect
          current.style.transform = `translate(${(x + camera.x) * camera.z}px, ${(y + camera.y) * camera.z}px) scale(${camera.z})`
        })
      )
    },
    { immediate: true }
  )

  let resizingNode: SubgraphIoNode | undefined
  const { startResize: resize } = useNodeResize(({ size: next }) => {
    const node = ioNode()
    if (!node || node !== resizingNode || canvasStore.isEditingBlocked) return
    const [x, y] = node.boundingRect
    node.pos = [x, y]
    node.size = [next.width, next.height]
    node.subgraph.setDirtyCanvas(true, true)
    size.trigger()
    layout.report(node.subgraph.id, node.id, {
      width: next.width,
      height: next.height,
      slotCenters: slotCenters.value
    })
  })

  function startResize(event: PointerEvent) {
    const node = ioNode()
    if (
      !node ||
      node.pinned ||
      event.button !== 0 ||
      canvasStore.isEditingBlocked ||
      collapsed()
    )
      return
    resizingNode = node
    resize(event, 'SE', element.value ?? undefined)
  }

  return { style, startResize }
}
