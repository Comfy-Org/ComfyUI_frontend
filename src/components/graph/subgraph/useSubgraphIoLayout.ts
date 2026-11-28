import { useResizeObserver } from '@vueuse/core'
import { computed, onScopeDispose, shallowRef, watch } from 'vue'
import type { Ref } from 'vue'

import type {
  Bounds,
  CompassCorners,
  Point2D,
  PointTuple,
  Size2D as Size
} from '@comfyorg/shared-frontend-utils/geometry'

import { onCanvasFrame } from '@/lib/litegraph/src/canvas/canvasFrame'
import type { SubgraphInputNode } from '@/lib/litegraph/src/subgraph/SubgraphInputNode'
import type { SubgraphOutputNode } from '@/lib/litegraph/src/subgraph/SubgraphOutputNode'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { MIN_NODE_WIDTH } from '@/renderer/core/layout/transform/graphRenderTransform'
import { useCompositedTransform } from '@/renderer/core/layout/transform/useCompositedTransform'
import { useTransformState } from '@/renderer/core/layout/transform/useTransformState'
import { useNodeResize } from '@/renderer/extensions/vueNodes/interactions/resize/useNodeResize'

type SubgraphIoNode = SubgraphInputNode | SubgraphOutputNode

function portHitRect(port: Element, origin: DOMRect, scale: number): Bounds {
  const rect = port.getBoundingClientRect()
  const haloWidth = Number.parseFloat(getComputedStyle(port, '::after').width)
  const width = Math.max(rect.width / scale, haloWidth || 0)
  const height = rect.height / scale
  const centerX = (rect.left + rect.width / 2 - origin.left) / scale
  const centerY = (rect.top + rect.height / 2 - origin.top) / scale
  return { x: centerX - width / 2, y: centerY - height / 2, width, height }
}

export function useSubgraphIoLayout(
  ioNode: () => SubgraphIoNode,
  element: Readonly<Ref<HTMLElement | null>>,
  slots: () => SubgraphIoNode['allSlots']
) {
  const canvasStore = useCanvasStore()
  const { camera, syncWithCanvas } = useTransformState()
  const { setTransform } = useCompositedTransform(element)
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
    const panelRect = panel.getBoundingClientRect()
    const scale = panelRect.height / panel.offsetHeight
    const graphId = node.subgraph.id
    layoutStore.reportContentSize(
      graphId,
      node.id,
      override ?? { width: panel.offsetWidth, height: panel.offsetHeight }
    )
    layoutStore.updateNodeSlotOffsets(
      graphId,
      node.id,
      rows.value.map((row, index) => ({
        index,
        type: node.slotDirection,
        bounds: portHitRect(
          row.querySelector('[data-port-anchor]') ?? row,
          panelRect,
          scale
        )
      }))
    )
    node.arrange()
    canvasStore.canvas?.setDirty(true, true)
  }

  onScopeDispose(() => {
    const node = ioNode()
    layoutStore.clearMeasuredGeometry(node.subgraph.id, node.id)
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
          if (!element.value) return
          syncWithCanvas(canvas)
          const [x, y] = ioNode().boundingRect
          setTransform(
            `translate(${(x + camera.x) * camera.z}px, ${(y + camera.y) * camera.z}px) scale(${camera.z})`
          )
        })
      )
    },
    { immediate: true }
  )

  let resizeOrigin: PointTuple = [0, 0]
  const { startResize: resize, nudgeResize } = useNodeResize(
    ({ size: next }) => {
      const node = ioNode()
      node.pos = resizeOrigin
      node.size = [next.width, next.height]
      report(next)
    }
  )

  function resizableOrigin() {
    const panel = element.value
    const node = ioNode()
    if (!panel || canvasStore.isReadOnly || node.pinned) return
    const [x, y] = node.boundingRect
    resizeOrigin = [x, y]
    return { element: panel, position: { x, y } }
  }

  function startResize(event: PointerEvent, corner: CompassCorners) {
    const origin = event.button === 0 && resizableOrigin()
    if (origin) resize(event, corner, origin)
  }

  function nudgeSize(
    event: KeyboardEvent,
    corner: CompassCorners,
    delta: Point2D
  ) {
    const origin = resizableOrigin()
    if (!origin) return
    nudgeResize(event, corner, delta, origin)
    useWorkflowStore().activeWorkflow?.changeTracker.captureCanvasState()
  }

  return { style, startResize, nudgeSize }
}
