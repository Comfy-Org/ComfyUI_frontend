import { computedWithControl, useResizeObserver } from '@vueuse/core'
import { computed, onScopeDispose, shallowRef, watch } from 'vue'
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
  ioNode: () => SubgraphIoNode,
  element: Readonly<Ref<HTMLElement | null>>,
  slots: () => SubgraphIoNode['allSlots']
) {
  const canvasStore = useCanvasStore()
  const layout = useSubgraphIoLayoutStore()
  const { camera, syncWithCanvas } = useTransformState()
  const isInput = computed(() => ioNode() === ioNode().subgraph.inputNode)
  const size = computedWithControl(ioNode, () => {
    const [storedWidth, height] = ioNode().size
    const width = Math.max(MIN_NODE_WIDTH, storedWidth)
    return { width, height, offsetX: isInput.value ? storedWidth - width : 0 }
  })
  const style = computed(() => ({
    '--node-width': `${size.value.width}px`,
    '--node-height': `${size.value.height}px`
  }))

  const rows = shallowRef<HTMLElement[]>([])
  function measure() {
    const panel = element.value
    if (!panel?.offsetHeight) return
    const panelRect = panel.getBoundingClientRect()
    const scale = panelRect.height / panel.offsetHeight
    return {
      width: panel.offsetWidth,
      height: panel.offsetHeight,
      slotCenters: rows.value.map((row) => {
        const port = row.querySelector('[data-port-anchor]') ?? row
        const rect = port.getBoundingClientRect()
        return (rect.top + rect.height / 2 - panelRect.top) / scale
      })
    }
  }
  function report(override?: { width: number; height: number }) {
    const measurement = measure()
    if (!measurement) return
    layout.report(ioNode(), {
      offsetX: size.value.offsetX,
      ...measurement,
      ...override
    })
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
  onScopeDispose(() => {
    layout.clear(ioNode())
    canvasStore.canvas?.setDirty(true, true)
  })

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
    const node = ioNode()
    const [x, y] = node.boundingRect
    node.pos = [x, y]
    node.size = [next.width, next.height]
    size.trigger()
    report(next)
  })

  function startResize(event: PointerEvent) {
    if (event.button !== 0 || canvasStore.isReadOnly || ioNode().pinned) return
    resize(event, 'SE', element.value ?? undefined)
  }

  return { isInput, style, startResize }
}
