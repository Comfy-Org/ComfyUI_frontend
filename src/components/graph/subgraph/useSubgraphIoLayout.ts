import { computedWithControl, useResizeObserver } from '@vueuse/core'
import { computed, onScopeDispose, shallowRef, watch } from 'vue'
import type { Ref } from 'vue'

import type {
  RectTuple,
  Size2D as Size
} from '@comfyorg/shared-frontend-utils/geometry'

import { onCanvasFrame } from '@/lib/litegraph/src/canvas/canvasFrame'
import type { SubgraphInputNode } from '@/lib/litegraph/src/subgraph/SubgraphInputNode'
import type { SubgraphOutputNode } from '@/lib/litegraph/src/subgraph/SubgraphOutputNode'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { MIN_NODE_WIDTH } from '@/renderer/core/layout/transform/graphRenderTransform'
import { useTransformState } from '@/renderer/core/layout/transform/useTransformState'
import { useNodeResize } from '@/renderer/extensions/vueNodes/interactions/resize/useNodeResize'

type SubgraphIoNode = SubgraphInputNode | SubgraphOutputNode

function portHitRect(port: Element, origin: DOMRect, scale: number): RectTuple {
  const rect = port.getBoundingClientRect()
  const haloWidth = Number.parseFloat(getComputedStyle(port, '::after').width)
  const width = Math.max(rect.width / scale, haloWidth || 0)
  const height = rect.height / scale
  const centerX = (rect.left + rect.width / 2 - origin.left) / scale
  const centerY = (rect.top + rect.height / 2 - origin.top) / scale
  return [centerX - width / 2, centerY - height / 2, width, height]
}

export function useSubgraphIoLayout(
  ioNode: () => SubgraphIoNode,
  element: Readonly<Ref<HTMLElement | null>>,
  slots: () => SubgraphIoNode['allSlots']
) {
  const canvasStore = useCanvasStore()
  const { camera, syncWithCanvas } = useTransformState()
  const size = computedWithControl(ioNode, () => {
    const [width, height] = ioNode().size
    return { width: Math.max(MIN_NODE_WIDTH, width), height }
  })
  const style = computed(() => ({
    '--node-width': `${size.value.width}px`,
    '--node-height': `${size.value.height}px`
  }))

  const rows = shallowRef<HTMLElement[]>([])
  function report(override?: Size) {
    const panel = element.value
    if (!panel?.offsetHeight) return
    const node = ioNode()
    const panelRect = panel.getBoundingClientRect()
    const scale = panelRect.height / panel.offsetHeight
    const { width, height } = override ?? {
      width: panel.offsetWidth,
      height: panel.offsetHeight
    }
    node.renderedLayout = {
      width,
      height,
      ports: rows.value.map((row) =>
        portHitRect(
          row.querySelector('[data-port-anchor]') ?? row,
          panelRect,
          scale
        )
      )
    }
    node.arrange()
    canvasStore.canvas?.setDirty(true, true)
  }

  onScopeDispose(() => {
    ioNode().renderedLayout = undefined
  })

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
        onCanvasFrame(canvas, 'present', () => {
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
    const panel = element.value
    const node = ioNode()
    if (event.button !== 0 || !panel || canvasStore.isReadOnly || node.pinned)
      return
    const [x, y] = node.boundingRect
    resize(event, 'SE', { element: panel, position: { x, y } })
  }

  return { style, startResize }
}
