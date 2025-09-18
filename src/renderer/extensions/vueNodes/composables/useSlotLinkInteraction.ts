import { type Fn, useEventListener } from '@vueuse/core'
import { onBeforeUnmount } from 'vue'

import { useSharedCanvasPositionConversion } from '@/composables/element/useCanvasPositionConversion'
import { LinkDirection } from '@/lib/litegraph/src/types/globalEnums'
import { evaluateCompatibility } from '@/renderer/core/canvas/links/slotLinkCompatibility'
import {
  type SlotDropCandidate,
  useSlotLinkDragState
} from '@/renderer/core/canvas/links/slotLinkDragState'
import { getSlotKey } from '@/renderer/core/layout/slots/slotIdentifier'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import type { SlotLayout } from '@/renderer/core/layout/types'
import { app } from '@/scripts/app'

interface SlotInteractionOptions {
  nodeId: string
  index: number
  type: 'input' | 'output'
  readonly?: boolean
}

interface SlotInteractionHandlers {
  onPointerDown: (event: PointerEvent) => void
}

export function useSlotLinkInteraction({
  nodeId,
  index,
  type,
  readonly
}: SlotInteractionOptions): SlotInteractionHandlers | null {
  if (readonly) {
    return null
  }

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

    const candidate: SlotDropCandidate = { layout, compatible: false }

    if (state.source) {
      candidate.compatible = evaluateCompatibility(
        state.source,
        candidate
      ).allowable
    }

    return candidate
  }

  const conversion = useSharedCanvasPositionConversion()

  let activePointerId: number | null = null
  let stopPointerMove: Fn | null = null
  let stopPointerUp: Fn | null = null
  let stopPointerCancel: Fn | null = null

  const cleanupListeners = () => {
    stopPointerMove?.()
    stopPointerUp?.()
    stopPointerCancel?.()
    stopPointerMove = null
    stopPointerUp = null
    stopPointerCancel = null
    activePointerId = null
    endDrag()
  }

  const updatePointerState = (event: PointerEvent) => {
    const clientX = event.clientX
    const clientY = event.clientY
    const [canvasX, canvasY] = conversion.clientPosToCanvasPos([
      clientX,
      clientY
    ])

    updatePointerPosition(clientX, clientY, canvasX, canvasY)
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

    if (source.type === 'output' && slotLayout.type === 'input') {
      const outputSlot = sourceNode.outputs?.[source.slotIndex]
      const inputSlot = targetNode.inputs?.[slotLayout.index]
      if (!outputSlot || !inputSlot) return
      graph.beforeChange()
      sourceNode.connectSlots(outputSlot, targetNode, inputSlot, undefined)
      return
    }

    if (source.type === 'input' && slotLayout.type === 'output') {
      const inputSlot = sourceNode.inputs?.[source.slotIndex]
      const outputSlot = targetNode.outputs?.[slotLayout.index]
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
      if (candidate?.compatible) {
        connectSlots(candidate.layout)
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
    app.canvas?.setDirty(true)
  }

  const onPointerDown = (event: PointerEvent) => {
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

    stopPointerMove = useEventListener(
      window,
      'pointermove',
      handlePointerMove,
      { capture: true }
    )
    stopPointerUp = useEventListener(window, 'pointerup', handlePointerUp, {
      capture: true
    })
    stopPointerCancel = useEventListener(
      window,
      'pointercancel',
      handlePointerCancel,
      { capture: true }
    )
    app.canvas?.setDirty(true)
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
