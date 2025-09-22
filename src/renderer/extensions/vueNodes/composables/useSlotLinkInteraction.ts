import { type Fn, useEventListener } from '@vueuse/core'
import log from 'loglevel'
import { onBeforeUnmount } from 'vue'

import { useSharedCanvasPositionConversion } from '@/composables/element/useCanvasPositionConversion'
import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { LLink, type LinkId } from '@/lib/litegraph/src/LLink'
import type { RerouteId } from '@/lib/litegraph/src/Reroute'
import type { INodeInputSlot } from '@/lib/litegraph/src/interfaces'
import { LinkDirection } from '@/lib/litegraph/src/types/globalEnums'
import { evaluateCompatibility } from '@/renderer/core/canvas/links/slotLinkCompatibility'
import type { MovedOutputNormalLink } from '@/renderer/core/canvas/links/slotLinkDragState'
import {
  type SlotDropCandidate,
  useSlotLinkDragState
} from '@/renderer/core/canvas/links/slotLinkDragState'
import { getSlotKey } from '@/renderer/core/layout/slots/slotIdentifier'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import type { Point, SlotLayout } from '@/renderer/core/layout/types'
import { toPoint } from '@/renderer/core/layout/utils/geometry'
import { app } from '@/scripts/app'

const logger = log.getLogger('useSlotLinkInteraction')

interface SlotInteractionOptions {
  nodeId: string
  index: number
  type: 'input' | 'output'
  readonly?: boolean
}

interface SlotInteractionHandlers {
  onPointerDown: (event: PointerEvent) => void
}

interface PointerSession {
  begin: (pointerId: number) => void
  register: (...stops: Array<Fn | null | undefined>) => void
  matches: (event: PointerEvent) => boolean
  isActive: () => boolean
  clear: () => void
}

function createPointerSession(): PointerSession {
  let pointerId: number | null = null
  let stops: Fn[] = []

  const begin = (id: number) => {
    pointerId = id
  }

  const register = (...newStops: Array<Fn | null | undefined>) => {
    for (const stop of newStops) {
      if (typeof stop === 'function') {
        stops.push(stop)
      }
    }
  }

  const matches = (event: PointerEvent) =>
    pointerId !== null && event.pointerId === pointerId

  const isActive = () => pointerId !== null

  const clear = () => {
    for (const stop of stops) {
      stop()
    }
    stops = []
    pointerId = null
  }

  return { begin, register, matches, isActive, clear }
}

export function useSlotLinkInteraction({
  nodeId,
  index,
  type,
  readonly
}: SlotInteractionOptions): SlotInteractionHandlers {
  if (readonly) {
    return {
      onPointerDown: () => {}
    }
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

  const pointerSession = createPointerSession()

  const draggingLinkIds = new Set<LinkId>()
  const draggingRerouteIds = new Set<RerouteId>()

  const movedOutputNormalLinks: MovedOutputNormalLink[] = []
  const movedOutputFloatingLinks: LLink[] = []

  const resolveLinkOrigin = (
    graph: LGraph,
    link: LLink | undefined
  ): { position: Point; direction: LinkDirection } | null => {
    if (!link) return null

    const originNodeId = link.origin_id
    const originSlotIndex = link.origin_slot

    const slotKey = getSlotKey(String(originNodeId), originSlotIndex, false)
    const layout = layoutStore.getSlotLayout(slotKey)

    if (layout) {
      return { position: { ...layout.position }, direction: LinkDirection.NONE }
    } else {
      const originNode = graph.getNodeById(originNodeId)

      logger.warn('Slot layout missing', {
        slotKey,
        originNodeId,
        originSlotIndex,
        linkId: link.id,
        fallback: originNode ? 'graph' : 'none'
      })

      if (!originNode) return null

      const [x, y] = originNode.getOutputPos(originSlotIndex)
      return { position: toPoint(x, y), direction: LinkDirection.NONE }
    }
  }

  const resolveExistingInputLinkAnchor = (
    graph: LGraph,
    inputSlot: INodeInputSlot | undefined
  ): { position: Point; direction: LinkDirection } | null => {
    if (!inputSlot) return null

    const directLink = graph.getLink(inputSlot.link)
    if (directLink) {
      const reroutes = LLink.getReroutes(graph, directLink)
      const lastReroute = reroutes.at(-1)
      if (lastReroute) {
        const rerouteLayout = layoutStore.getRerouteLayout(lastReroute.id)
        if (rerouteLayout) {
          return {
            position: { ...rerouteLayout.position },
            direction: LinkDirection.NONE
          }
        }

        const pos = lastReroute.pos
        if (pos) {
          return {
            position: toPoint(pos[0], pos[1]),
            direction: LinkDirection.NONE
          }
        }
      }

      const directAnchor = resolveLinkOrigin(graph, directLink)
      if (directAnchor) return directAnchor
    }

    const floatingLinkIterator = inputSlot._floatingLinks?.values()
    const floatingLink = floatingLinkIterator
      ? floatingLinkIterator.next().value
      : undefined
    if (!floatingLink) return null

    if (floatingLink.parentId != null) {
      const rerouteLayout = layoutStore.getRerouteLayout(floatingLink.parentId)
      if (rerouteLayout) {
        return {
          position: { ...rerouteLayout.position },
          direction: LinkDirection.NONE
        }
      }

      const reroute = graph.getReroute(floatingLink.parentId)
      if (reroute) {
        return {
          position: toPoint(reroute.pos[0], reroute.pos[1]),
          direction: LinkDirection.NONE
        }
      }
    }

    return null
  }

  const resolveInputDragOrigin = (
    graph: LGraph,
    sourceNode: LGraphNode,
    slotIndex: number,
    linkId: number | undefined
  ) => {
    const inputSlot = sourceNode.inputs?.[slotIndex]
    if (!inputSlot) return null

    const mapLinkToOrigin = (link: LLink | undefined | null) => {
      if (!link) return null

      const originNode = graph.getNodeById(link.origin_id)
      const originSlot = originNode?.outputs?.[link.origin_slot]
      if (!originNode || !originSlot) return null

      return {
        node: originNode,
        slot: originSlot,
        slotIndex: link.origin_slot,
        afterRerouteId: link.parentId ?? null
      }
    }

    if (linkId != null) {
      const fromStoredLink = mapLinkToOrigin(graph.getLink(linkId))
      if (fromStoredLink) return fromStoredLink
    }

    const fromDirectLink = mapLinkToOrigin(graph.getLink(inputSlot.link))
    if (fromDirectLink) return fromDirectLink

    const floatingLinkIterator = inputSlot._floatingLinks?.values()
    const floatingLink = floatingLinkIterator
      ? floatingLinkIterator.next().value
      : undefined
    if (!floatingLink || floatingLink.isFloating) return null

    const originNode = graph.getNodeById(floatingLink.origin_id)
    const originSlot = originNode?.outputs?.[floatingLink.origin_slot]
    if (!originNode || !originSlot) return null

    return {
      node: originNode,
      slot: originSlot,
      slotIndex: floatingLink.origin_slot,
      afterRerouteId: floatingLink.parentId ?? null
    }
  }

  const clearDraggingFlags = () => {
    const canvas = app.canvas
    const graph = canvas?.graph
    const source = state.source
    if (!canvas || !graph) return

    if (source?.linkId != null) {
      const activeLink = graph.getLink(source.linkId)
      if (activeLink) delete activeLink._dragging
    }

    for (const id of draggingLinkIds) {
      const link = graph.getLink(id)
      if (link) delete link._dragging
    }
    for (const id of draggingRerouteIds) {
      const reroute = graph.getReroute(id)
      if (reroute) reroute._dragging = undefined
    }

    draggingLinkIds.clear()
    draggingRerouteIds.clear()
  }

  const cleanupInteraction = () => {
    clearDraggingFlags()
    pointerSession.clear()
    endDrag()
    movedOutputNormalLinks.length = 0
    movedOutputFloatingLinks.length = 0
  }

  const disconnectSourceLink = (): boolean => {
    const canvas = app.canvas
    const graph = canvas?.graph
    const source = state.source
    if (!canvas || !graph || !source) return false

    const sourceNode = graph.getNodeById(Number(source.nodeId))
    if (!sourceNode) return false

    graph.beforeChange()
    if (source.type === 'input') {
      return sourceNode.disconnectInput(source.slotIndex, true)
    }

    return sourceNode.disconnectOutput(source.slotIndex)
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
    if (!pointerSession.matches(event)) return
    updatePointerState(event)
    app.canvas?.setDirty(true)
  }

  const connectSlots = (slotLayout: SlotLayout): boolean => {
    const canvas = app.canvas
    const graph = canvas?.graph
    const source = state.source
    if (!canvas || !graph || !source) return false

    const sourceNode = graph.getNodeById(Number(source.nodeId))
    const targetNode = graph.getNodeById(Number(slotLayout.nodeId))
    if (!sourceNode || !targetNode) return false

    // Output ➝ Output (shift‑drag move all links)
    if (source.type === 'output' && slotLayout.type === 'output') {
      if (!source.multiOutputDrag) return false

      const targetOutput = targetNode.outputs?.[slotLayout.index]
      if (!targetOutput) return false

      // Reconnect all normal links captured at drag start
      for (const {
        inputNodeId,
        inputSlotIndex,
        parentRerouteId
      } of movedOutputNormalLinks) {
        const inputNode = graph.getNodeById(inputNodeId)
        const inputSlot = inputNode?.inputs?.[inputSlotIndex]
        if (!inputNode || !inputSlot) continue

        targetNode.connectSlots(
          targetOutput,
          inputNode,
          inputSlot,
          parentRerouteId
        )
      }

      // Move any floating links across to the new output
      const sourceNodeAtStart = graph.getNodeById(Number(source.nodeId))
      const sourceOutputAtStart = sourceNodeAtStart?.outputs?.[source.slotIndex]
      if (sourceOutputAtStart?._floatingLinks?.size) {
        for (const floatingLink of movedOutputFloatingLinks) {
          sourceOutputAtStart._floatingLinks?.delete(floatingLink)

          floatingLink.origin_id = targetNode.id
          floatingLink.origin_slot = slotLayout.index

          targetOutput._floatingLinks ??= new Set()
          targetOutput._floatingLinks.add(floatingLink)
        }
      }

      return true
    }

    if (source.type === 'output' && slotLayout.type === 'input') {
      const outputSlot = sourceNode.outputs?.[source.slotIndex]
      const inputSlot = targetNode.inputs?.[slotLayout.index]
      if (!outputSlot || !inputSlot) return false
      const existingLink = graph.getLink(inputSlot.link)
      const afterRerouteId = existingLink?.parentId ?? undefined
      sourceNode.connectSlots(outputSlot, targetNode, inputSlot, afterRerouteId)
      return true
    }

    if (source.type === 'input') {
      const inputSlot = sourceNode.inputs?.[source.slotIndex]
      if (!inputSlot) return false

      const origin = resolveInputDragOrigin(
        graph,
        sourceNode,
        source.slotIndex,
        source.linkId
      )

      if (slotLayout.type === 'output') {
        const outputSlot = targetNode.outputs?.[slotLayout.index]
        if (!outputSlot) return false

        const afterRerouteId =
          origin &&
          String(origin.node.id) === slotLayout.nodeId &&
          origin.slotIndex === slotLayout.index
            ? origin.afterRerouteId ?? undefined
            : undefined

        targetNode.connectSlots(
          outputSlot,
          sourceNode,
          inputSlot,
          afterRerouteId
        )
        return true
      }

      if (slotLayout.type === 'input') {
        if (!origin) return false

        const outputNode = origin.node
        const outputSlot = origin.slot
        const newInputSlot = targetNode.inputs?.[slotLayout.index]
        if (!outputSlot || !newInputSlot) return false
        sourceNode.disconnectInput(source.slotIndex, true)
        outputNode.connectSlots(
          outputSlot,
          targetNode,
          newInputSlot,
          origin.afterRerouteId ?? undefined
        )
        return true
      }
    }

    return false
  }

  const finishInteraction = (event: PointerEvent) => {
    if (!pointerSession.matches(event)) return
    event.preventDefault()

    if (state.source) {
      const candidate = candidateFromTarget(event.target)
      let connected = false
      if (candidate?.compatible) {
        connected = connectSlots(candidate.layout)
      }

      if (!connected && !candidate && state.source.type === 'input') {
        disconnectSourceLink()
      }
    }

    cleanupInteraction()
    app.canvas?.setDirty(true)
  }

  const handlePointerUp = (event: PointerEvent) => {
    finishInteraction(event)
  }

  const handlePointerCancel = (event: PointerEvent) => {
    if (!pointerSession.matches(event)) return
    cleanupInteraction()
    app.canvas?.setDirty(true)
  }

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return
    if (!nodeId) return
    if (pointerSession.isActive()) return

    const canvas = app.canvas
    const graph = canvas?.graph
    if (!canvas || !graph) return

    const layout = layoutStore.getSlotLayout(
      getSlotKey(nodeId, index, type === 'input')
    )
    if (!layout) return

    const resolvedNode = graph.getNodeById(Number(nodeId))
    const inputSlot =
      type === 'input' ? resolvedNode?.inputs?.[index] : undefined

    const ctrlOrMeta = event.ctrlKey || event.metaKey
    const hasExistingInputLink = Boolean(
      inputSlot && (inputSlot.link != null || inputSlot._floatingLinks?.size)
    )

    const shouldBreakExistingLink =
      hasExistingInputLink && ctrlOrMeta && event.altKey && !event.shiftKey

    const existingLink =
      type === 'input' && inputSlot?.link != null
        ? graph.getLink(inputSlot.link)
        : undefined

    if (shouldBreakExistingLink && resolvedNode) {
      resolvedNode.disconnectInput(index, true)
    }

    const baseDirection =
      type === 'input'
        ? inputSlot?.dir ?? LinkDirection.LEFT
        : resolvedNode?.outputs?.[index]?.dir ?? LinkDirection.RIGHT

    const existingAnchor =
      type === 'input' && !shouldBreakExistingLink
        ? resolveExistingInputLinkAnchor(graph, inputSlot)
        : null

    if (!shouldBreakExistingLink && existingLink) {
      existingLink._dragging = true
    }

    const outputSlot =
      type === 'output' ? resolvedNode?.outputs?.[index] : undefined
    const isMultiOutputDrag =
      type === 'output' &&
      Boolean(
        outputSlot &&
          (outputSlot.links?.length || outputSlot._floatingLinks?.size)
      ) &&
      event.shiftKey

    if (isMultiOutputDrag && outputSlot) {
      movedOutputNormalLinks.length = 0
      movedOutputFloatingLinks.length = 0

      if (outputSlot.links?.length) {
        for (const linkId of outputSlot.links) {
          const link = graph.getLink(linkId)
          if (!link) continue

          const firstReroute = LLink.getFirstReroute(graph, link)
          if (firstReroute) {
            firstReroute._dragging = true
            draggingRerouteIds.add(firstReroute.id)
          } else {
            link._dragging = true
            draggingLinkIds.add(link.id)
          }

          movedOutputNormalLinks.push({
            linkId: link.id,
            inputNodeId: link.target_id,
            inputSlotIndex: link.target_slot,
            parentRerouteId: link.parentId
          })
        }
      }

      if (outputSlot._floatingLinks?.size) {
        for (const floatingLink of outputSlot._floatingLinks) {
          movedOutputFloatingLinks.push(floatingLink)
        }
      }
    }

    const direction = existingAnchor?.direction ?? baseDirection
    const startPosition = existingAnchor?.position ?? {
      x: layout.position.x,
      y: layout.position.y
    }

    beginDrag(
      {
        nodeId,
        slotIndex: index,
        type,
        direction,
        position: startPosition,
        linkId: !shouldBreakExistingLink ? existingLink?.id : undefined,
        multiOutputDrag: isMultiOutputDrag
      },
      event.pointerId
    )

    pointerSession.begin(event.pointerId)

    updatePointerState(event)

    pointerSession.register(
      useEventListener(window, 'pointermove', handlePointerMove, {
        capture: true
      }),
      useEventListener(window, 'pointerup', handlePointerUp, {
        capture: true
      }),
      useEventListener(window, 'pointercancel', handlePointerCancel, {
        capture: true
      })
    )
    app.canvas?.setDirty(true)
    event.preventDefault()
    event.stopPropagation()
  }

  onBeforeUnmount(() => {
    if (pointerSession.isActive()) {
      cleanupInteraction()
    }
  })

  return {
    onPointerDown
  }
}
