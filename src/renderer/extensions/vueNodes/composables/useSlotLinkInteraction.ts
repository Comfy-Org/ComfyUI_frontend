import { onBeforeUnmount } from 'vue'

import { useSharedCanvasPositionConversion } from '@/composables/element/useCanvasPositionConversion'
import type {
  INodeInputSlot,
  INodeOutputSlot
} from '@/lib/litegraph/src/interfaces'
import { LinkDirection } from '@/lib/litegraph/src/types/globalEnums'
import { getSlotKey } from '@/renderer/core/layout/slots/slotIdentifier'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import type { SlotLayout } from '@/renderer/core/layout/types'
import { evaluateCompatibility } from '@/renderer/core/linkInteractions/slotLinkCompatibility'
import {
  type SlotDropCandidate,
  useSlotLinkDragState
} from '@/renderer/core/linkInteractions/slotLinkDragState'
import { app } from '@/scripts/app'

interface SlotInteractionOptions {
  nodeId: string
  index: number
  type: 'input' | 'output'
  readonly?: boolean
}

export function useSlotLinkInteraction({
  nodeId,
  index,
  type,
  readonly
}: SlotInteractionOptions) {
  const { state, beginDrag, endDrag, updatePointerPosition } =
    useSlotLinkDragState()

  function candidateFromTarget(
    target: EventTarget | null
  ): SlotDropCandidate | null {
    if (!(target instanceof HTMLElement)) return null
    const key = target.dataset['slotKey']
    if (!key) return null

    const layout = layoutStore.getSlotLayout(key)
    if (!layout) return null

    return { layout, compatible: true }
  }

  const conversion = useSharedCanvasPositionConversion()

  let activePointerId: number | null = null

  const cleanupListeners = () => {
    window.removeEventListener('pointermove', handlePointerMove, true)
    window.removeEventListener('pointerup', handlePointerUp, true)
    window.removeEventListener('pointercancel', handlePointerCancel, true)
    activePointerId = null
    endDrag()
  }

  const updatePointerState = (event: PointerEvent) => {
    const client = { x: event.clientX, y: event.clientY }
    const [canvasX, canvasY] = conversion.clientPosToCanvasPos([
      client.x,
      client.y
    ])

    updatePointerPosition({
      client,
      canvas: { x: canvasX, y: canvasY }
    })
  }

  const handlePointerMove = (event: PointerEvent) => {
    if (event.pointerId !== activePointerId) return
    updatePointerState(event)
    app.canvas?.setDirty(true)
  }

  const connectSlots = (slotLayout: SlotLayout) => {
    const canvas = app.canvas
    const graph = canvas?.graph
    const source = state.source
    if (!canvas || !graph || !source) return

    const sourceNode = graph.getNodeById(Number(source.nodeId))
    const targetNode = graph.getNodeById(Number(slotLayout.nodeId))
    if (!sourceNode || !targetNode) return

    const sourceSlot =
      source.type === 'output'
        ? sourceNode.outputs?.[source.slotIndex]
        : sourceNode.inputs?.[source.slotIndex]
    const targetSlot =
      slotLayout.type === 'input'
        ? targetNode.inputs?.[slotLayout.index]
        : targetNode.outputs?.[slotLayout.index]

    if (!sourceSlot || !targetSlot) return

    if (source.type === 'output' && slotLayout.type === 'input') {
      const outputSlot = sourceSlot as INodeOutputSlot | undefined
      const inputSlot = targetSlot as INodeInputSlot | undefined
      if (!outputSlot || !inputSlot) return
      graph.beforeChange()
      sourceNode.connectSlots(outputSlot, targetNode, inputSlot, undefined)
      return
    }

    if (source.type === 'input' && slotLayout.type === 'output') {
      const inputSlot = sourceSlot as INodeInputSlot | undefined
      const outputSlot = targetSlot as INodeOutputSlot | undefined
      if (!inputSlot || !outputSlot) return
      graph.beforeChange()
      sourceNode.disconnectInput(source.slotIndex, true)
      targetNode.connectSlots(outputSlot, sourceNode, inputSlot, undefined)
    }
  }

  const finishInteraction = (event: PointerEvent) => {
    if (event.pointerId !== activePointerId) return
    event.preventDefault()

    if (state.source) {
      const candidate = candidateFromTarget(event.target)
      if (candidate) {
        const result = evaluateCompatibility(state.source, candidate)
        if (result.allowable) {
          connectSlots(candidate.layout)
        }
      }
    }

    cleanupListeners()
    app.canvas?.setDirty(true)
  }

  const handlePointerUp = (event: PointerEvent) => {
    finishInteraction(event)
  }

  const handlePointerCancel = (event: PointerEvent) => {
    if (event.pointerId !== activePointerId) return
    cleanupListeners()
    app.canvas?.setDirty(true, true)
  }

  const onPointerDown = (event: PointerEvent) => {
    if (readonly) return
    if (event.button !== 0) return
    if (!nodeId) return
    if (activePointerId !== null) return

    const canvas = app.canvas
    const graph = canvas?.graph
    if (!canvas || !graph) return

    const layout = layoutStore.getSlotLayout(
      getSlotKey(nodeId, index, type === 'input')
    )
    if (!layout) return

    const resolvedNode = graph.getNodeById(Number(nodeId))
    const slot =
      type === 'input'
        ? resolvedNode?.inputs?.[index]
        : resolvedNode?.outputs?.[index]

    const direction =
      slot?.dir ?? (type === 'input' ? LinkDirection.LEFT : LinkDirection.RIGHT)

    beginDrag(
      {
        nodeId,
        slotIndex: index,
        type,
        direction,
        position: layout.position
      },
      event.pointerId
    )

    activePointerId = event.pointerId

    updatePointerState(event)

    window.addEventListener('pointermove', handlePointerMove, true)
    window.addEventListener('pointerup', handlePointerUp, true)
    window.addEventListener('pointercancel', handlePointerCancel, true)
    app.canvas?.setDirty(true, true)
    event.preventDefault()
    event.stopPropagation()
  }

  onBeforeUnmount(() => {
    if (activePointerId !== null) {
      cleanupListeners()
    }
  })

  return {
    onPointerDown
  }
}
