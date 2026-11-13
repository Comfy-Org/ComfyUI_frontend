import { useResizeObserver } from '@vueuse/core'
import { computed, shallowRef, watch } from 'vue'
import type { Ref } from 'vue'

import type { Size2D as Size } from '@comfyorg/shared-frontend-utils/geometry'

import { onCanvasFrame } from '@/lib/litegraph/src/canvas/canvasFrame'
import type { SubgraphInputNode } from '@/lib/litegraph/src/subgraph/SubgraphInputNode'
import type { SubgraphOutputNode } from '@/lib/litegraph/src/subgraph/SubgraphOutputNode'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { MIN_NODE_WIDTH } from '@/renderer/core/layout/transform/graphRenderTransform'
import { useTransformState } from '@/renderer/core/layout/transform/useTransformState'
import { useNodeResize } from '@/renderer/extensions/vueNodes/interactions/resize/useNodeResize'

type SubgraphIoNode = SubgraphInputNode | SubgraphOutputNode

export function useSubgraphIoLayout(
  ioNode: () => SubgraphIoNode,
  element: Readonly<Ref<HTMLElement | null>>,
  slots: () => SubgraphIoNode['allSlots']
) {
  const canvasStore = useCanvasStore()
  const { camera, syncWithCanvas } = useTransformState()
  const isInput = computed(() => ioNode() === ioNode().subgraph.inputNode)
  const style = computed(() => {
    const [width, height] = ioNode().size
    return {
      '--node-width': `${Math.max(MIN_NODE_WIDTH, width)}px`,
      '--node-height': `${height}px`
    }
  })

  const rows = shallowRef<HTMLElement[]>([])
  function report(override?: Size) {
    const panel = element.value
    if (!panel?.offsetHeight) return
    const node = ioNode()
    const type = node.slotDirection
    const panelRect = panel.getBoundingClientRect()
    const scale = panelRect.height / panel.offsetHeight
    const x = type === 'input' ? 0 : panel.offsetWidth
    layoutStore.reportContentSize(
      node.subgraph.id,
      node.id,
      override ?? { width: panel.offsetWidth, height: panel.offsetHeight }
    )
    layoutStore.updateNodeSlotOffsets(
      node.subgraph.id,
      node.id,
      rows.value.map((row, index) => {
        const port = row.querySelector('[data-port-anchor]') ?? row
        const rect = port.getBoundingClientRect()
        const y = (rect.top + rect.height / 2 - panelRect.top) / scale
        return { index, type, position: { x, y } }
      }),
      'expanded'
    )
    node.arrange()
    canvasStore.canvas?.setDirty(true, true)
  }

  useResizeObserver(
    () => [element.value, ...rows.value],
    () => report()
  )
  watch(
    [element, slots],
    () => {
      rows.value = [
        ...(element.value?.querySelectorAll<HTMLElement>(
          '[data-subgraph-port]'
        ) ?? [])
      ]
      report()
    },
    { flush: 'post', immediate: true }
  )

  watch(
    () => canvasStore.canvas,
    (canvas, _, onCleanup) => {
      if (!canvas) return
      onCleanup(
        onCanvasFrame(canvas.canvas, 'present', () => {
          const current = element.value
          if (!current) return
          syncWithCanvas(canvas)
          const [x, y] = ioNode().boundingRect
          current.style.transform = `translate(${(x + camera.x) * camera.z}px, ${(y + camera.y) * camera.z}px) scale(${camera.z})`
        })
      )
    },
    { immediate: true }
  )

  const { startResize: resize } = useNodeResize(({ size: next }) => {
    ioNode().size = [next.width, next.height]
    report(next)
  })

  function startResize(event: PointerEvent) {
    if (event.button !== 0 || canvasStore.isReadOnly || ioNode().pinned) return
    resize(event, 'SE', element.value ?? undefined)
  }

  return { isInput, style, startResize }
}
