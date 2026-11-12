import { computedWithControl, useElementSize } from '@vueuse/core'
import { computed, watch } from 'vue'
import type { Ref } from 'vue'
import type { Subgraph } from '@comfyorg/graph-model/entityRegistry'

import { useSubgraphInputValuesStore } from '@/components/graph/subgraph/subgraphInputValuesStore'
import { onCanvasFrame } from '@/lib/litegraph/src/canvas/canvasFrame'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { SubgraphIONodeBase } from '@/lib/litegraph/src/subgraph/SubgraphIONodeBase'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useSubgraphIoLayoutStore } from '@/renderer/core/layout/store/subgraphIoLayoutStore'
import { MIN_NODE_WIDTH } from '@/renderer/core/layout/transform/graphRenderTransform'
import { useTransformState } from '@/renderer/core/layout/transform/useTransformState'
import { useNodeResize } from '@/renderer/extensions/vueNodes/interactions/resize/useNodeResize'

export function useSubgraphInputLayout(
  element: Readonly<Ref<HTMLElement | null>>,
  header: Readonly<Ref<HTMLElement | null>>,
  collapsed: () => boolean
) {
  const context = useSubgraphInputValuesStore()
  const canvasStore = useCanvasStore()
  const layout = useSubgraphIoLayoutStore()
  const { camera, syncWithCanvas } = useTransformState()
  const { width, height } = useElementSize(element, undefined, {
    box: 'border-box'
  })
  const { height: headerHeight } = useElementSize(header, undefined, {
    box: 'border-box'
  })
  const socketInset =
    SubgraphIONodeBase.roundedRadius + LiteGraph.NODE_SLOT_HEIGHT / 2
  const size = computedWithControl(
    () => context.graph,
    () => {
      const bounds = context.graph?.inputNode.asSerialisable().bounding
      return {
        width: Math.max(MIN_NODE_WIDTH, (bounds?.[2] ?? 0) - socketInset),
        height: bounds?.[3] ?? 0
      }
    }
  )
  const style = computed(() => ({
    '--node-width': `${size.value.width}px`,
    '--node-height': collapsed() ? '0px' : `${size.value.height}px`,
    '--min-node-width': `${MIN_NODE_WIDTH}px`
  }))

  watch(
    [
      () => context.graph,
      () => canvasStore.linearMode,
      width,
      height,
      headerHeight
    ],
    (_, __, onCleanup) => {
      const graph = context.graph
      if (!graph || canvasStore.linearMode) return
      const nodeId = graph.inputNode.id
      layout.report(graph.id, nodeId, {
        width: width.value || size.value.width,
        height: height.value || size.value.height,
        slotTop: (headerHeight.value || LiteGraph.NODE_TITLE_HEIGHT) + 4
      })
      canvasStore.canvas?.setDirty(true, true)
      onCleanup(() => {
        layout.clear(graph.id, nodeId)
        canvasStore.canvas?.setDirty(true, true)
      })
    },
    { flush: 'sync', immediate: true }
  )

  watch(
    [() => context.graph, () => canvasStore.canvas],
    ([graph, canvas], _, onCleanup) => {
      if (!graph || !canvas) return
      onCleanup(
        onCanvasFrame(canvas.canvas, 'present', () => {
          const current = element.value
          if (!current) return
          syncWithCanvas(canvas)
          const [x, y] = graph.inputNode.boundingRect
          current.style.transform = `translate(${(x + camera.x) * camera.z}px, ${(y + camera.y) * camera.z}px) scale(${camera.z})`
        })
      )
    },
    { immediate: true }
  )

  let resizingGraph: Subgraph | undefined
  const { startResize: resize } = useNodeResize(({ size: next }) => {
    const graph = context.graph
    if (!graph || graph !== resizingGraph || canvasStore.isEditingBlocked)
      return
    const node = graph.inputNode
    const [x, y] = node.boundingRect
    node.pos = [x, y]
    node.size = [next.width + socketInset, next.height]
    graph.setDirtyCanvas(true, true)
    size.trigger()
    layout.report(graph.id, node.id, {
      width: next.width,
      height: next.height,
      slotTop: headerHeight.value + 4
    })
  })

  function startResize(event: PointerEvent) {
    const graph = context.graph
    if (
      !graph ||
      graph.inputNode.pinned ||
      event.button !== 0 ||
      canvasStore.isEditingBlocked ||
      collapsed()
    )
      return
    resizingGraph = graph
    resize(event, 'SE', element.value ?? undefined)
  }

  return { style, startResize }
}
