import { useEventListener } from '@vueuse/core'
import type { Fn } from '@vueuse/core'
import { onBeforeUnmount } from 'vue'

import { useSharedCanvasPositionConversion } from '@/composables/element/useCanvasPositionConversion'
import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { LLink } from '@/lib/litegraph/src/LLink'
import type { Reroute } from '@/lib/litegraph/src/Reroute'
import type { RenderLink } from '@/lib/litegraph/src/canvas/RenderLink'
import type {
  INodeInputSlot,
  INodeOutputSlot
} from '@/lib/litegraph/src/interfaces'
import { LinkDirection } from '@/lib/litegraph/src/types/globalEnums'
import { createLinkConnectorAdapter } from '@/renderer/core/canvas/links/linkConnectorAdapter'
import type { LinkConnectorAdapter } from '@/renderer/core/canvas/links/linkConnectorAdapter'
import { useSlotLinkDragState } from '@/renderer/core/canvas/links/slotLinkDragState'
import type { SlotDropCandidate } from '@/renderer/core/canvas/links/slotLinkDragState'
import { getSlotKey } from '@/renderer/core/layout/slots/slotIdentifier'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import type { Point } from '@/renderer/core/layout/types'
import { toPoint } from '@/renderer/core/layout/utils/geometry'
import { createSlotLinkDragSession } from '@/renderer/extensions/vueNodes/composables/slotLinkDragSession'
import { app } from '@/scripts/app'
import { createRafBatch } from '@/utils/rafBatch'

interface SlotInteractionOptions {
  nodeId: string
  index: number
  type: 'input' | 'output'
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
  type
}: SlotInteractionOptions): SlotInteractionHandlers {
  const { state, beginDrag, endDrag, updatePointerPosition, setCandidate } =
    useSlotLinkDragState()
  const conversion = useSharedCanvasPositionConversion()
  const pointerSession = createPointerSession()
  let activeAdapter: LinkConnectorAdapter | null = null

  // Per-drag drag-state cache
  const dragSession = createSlotLinkDragSession()

  function candidateFromTarget(
    target: EventTarget | null
  ): SlotDropCandidate | null {
    if (!(target instanceof HTMLElement)) return null
    const elWithKey = target.closest<HTMLElement>('[data-slot-key]')
    const key = elWithKey?.dataset['slotKey']
    if (!key) return null

    const layout = layoutStore.getSlotLayout(key)
    if (!layout) return null

    const candidate: SlotDropCandidate = { layout, compatible: false }

    const graph = app.canvas?.graph
    const adapter = ensureActiveAdapter()
    if (graph && adapter) {
      const cached = dragSession.compatCache.get(key)
      if (cached != null) {
        candidate.compatible = cached
      } else {
        const compatible =
          layout.type === 'input'
            ? adapter.isInputValidDrop(layout.nodeId, layout.index)
            : adapter.isOutputValidDrop(layout.nodeId, layout.index)
        dragSession.compatCache.set(key, compatible)
        candidate.compatible = compatible
      }
    }

    return candidate
  }

  function candidateFromNodeTarget(
    target: EventTarget | null
  ): SlotDropCandidate | null {
    if (!(target instanceof HTMLElement)) return null
    const elWithNode = target.closest<HTMLElement>('[data-node-id]')
    const nodeIdStr = elWithNode?.dataset['nodeId']
    if (!nodeIdStr) return null

    const adapter = ensureActiveAdapter()
    const graph = app.canvas?.graph
    if (!adapter || !graph) return null

    const nodeId = Number(nodeIdStr)

    // Cached preferred slot for this node within this drag
    const cachedPreferred = dragSession.nodePreferred.get(nodeId)
    if (cachedPreferred !== undefined) {
      return cachedPreferred
        ? { layout: cachedPreferred.layout, compatible: true }
        : null
    }

    const node = graph.getNodeById(nodeId)
    if (!node) return null

    const firstLink = adapter.renderLinks[0]
    if (!firstLink) return null
    const connectingTo = adapter.linkConnector.state.connectingTo

    if (connectingTo !== 'input' && connectingTo !== 'output') return null

    const isInput = connectingTo === 'input'
    const slotType = firstLink.fromSlot.type

    const res = isInput
      ? node.findInputByType(slotType)
      : node.findOutputByType(slotType)

    const index = res?.index
    if (index == null) return null

    const key = getSlotKey(String(nodeId), index, isInput)
    const layout = layoutStore.getSlotLayout(key)
    if (!layout) return null

    const compatible = isInput
      ? adapter.isInputValidDrop(nodeId, index)
      : adapter.isOutputValidDrop(nodeId, index)

    if (compatible) {
      dragSession.compatCache.set(key, true)
      const preferred = { index, key, layout }
      dragSession.nodePreferred.set(nodeId, preferred)
      return { layout, compatible: true }
    } else {
      dragSession.compatCache.set(key, false)
      dragSession.nodePreferred.set(nodeId, null)
      return null
    }
  }

  const ensureActiveAdapter = (): LinkConnectorAdapter | null => {
    if (!activeAdapter) activeAdapter = createLinkConnectorAdapter()
    return activeAdapter
  }

  function hasCanConnectToReroute(
    link: RenderLink
  ): link is RenderLink & { canConnectToReroute: (r: Reroute) => boolean } {
    return 'canConnectToReroute' in link
  }

  type ToInputLink = RenderLink & { toType: 'input' }
  type ToOutputLink = RenderLink & { toType: 'output' }
  const isToInputLink = (link: RenderLink): link is ToInputLink =>
    link.toType === 'input'
  const isToOutputLink = (link: RenderLink): link is ToOutputLink =>
    link.toType === 'output'

  function connectLinksToInput(
    links: ReadonlyArray<RenderLink>,
    node: LGraphNode,
    inputSlot: INodeInputSlot
  ): boolean {
    const validCandidates = links
      .filter(isToInputLink)
      .filter((link) => link.canConnectToInput(node, inputSlot))

    for (const link of validCandidates) {
      link.connectToInput(node, inputSlot, activeAdapter?.linkConnector.events)
    }

    return validCandidates.length > 0
  }

  function connectLinksToOutput(
    links: ReadonlyArray<RenderLink>,
    node: LGraphNode,
    outputSlot: INodeOutputSlot
  ): boolean {
    const validCandidates = links
      .filter(isToOutputLink)
      .filter((link) => link.canConnectToOutput(node, outputSlot))

    for (const link of validCandidates) {
      link.connectToOutput(
        node,
        outputSlot,
        activeAdapter?.linkConnector.events
      )
    }

    return validCandidates.length > 0
  }

  const resolveLinkOrigin = (
    link: LLink | undefined
  ): { position: Point; direction: LinkDirection } | null => {
    if (!link) return null

    const slotKey = getSlotKey(String(link.origin_id), link.origin_slot, false)
    const layout = layoutStore.getSlotLayout(slotKey)
    if (!layout) return null

    return { position: { ...layout.position }, direction: LinkDirection.NONE }
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

      const directAnchor = resolveLinkOrigin(directLink)
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

  const cleanupInteraction = () => {
    activeAdapter?.reset()
    pointerSession.clear()
    endDrag()
    activeAdapter = null
    raf.cancel()
    dragSession.dispose()
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

  const processPointerMoveFrame = () => {
    const data = dragSession.pendingMove
    if (!data) return
    dragSession.pendingMove = null

    const [canvasX, canvasY] = conversion.clientPosToCanvasPos([
      data.clientX,
      data.clientY
    ])
    updatePointerPosition(data.clientX, data.clientY, canvasX, canvasY)

    let hoveredSlotKey: string | null = null
    let hoveredNodeId: number | null = null
    const target = data.target
    if (target instanceof HTMLElement) {
      hoveredSlotKey =
        target.closest<HTMLElement>('[data-slot-key]')?.dataset['slotKey'] ??
        null
      if (!hoveredSlotKey) {
        const nodeIdStr =
          target.closest<HTMLElement>('[data-node-id]')?.dataset['nodeId']
        hoveredNodeId = nodeIdStr != null ? Number(nodeIdStr) : null
      }
    }

    const hoverChanged =
      hoveredSlotKey !== dragSession.lastHoverSlotKey ||
      hoveredNodeId !== dragSession.lastHoverNodeId

    let candidate: SlotDropCandidate | null = state.candidate

    if (hoverChanged) {
      const slotCandidate = candidateFromTarget(target)
      const nodeCandidate = slotCandidate
        ? null
        : candidateFromNodeTarget(target)
      candidate = slotCandidate ?? nodeCandidate
      dragSession.lastHoverSlotKey = hoveredSlotKey
      dragSession.lastHoverNodeId = hoveredNodeId
    }

    const newCandidate = candidate?.compatible ? candidate : null
    const newCandidateKey = newCandidate
      ? getSlotKey(
          newCandidate.layout.nodeId,
          newCandidate.layout.index,
          newCandidate.layout.type === 'input'
        )
      : null

    if (newCandidateKey !== dragSession.lastCandidateKey) {
      setCandidate(newCandidate)
      dragSession.lastCandidateKey = newCandidateKey
    }

    app.canvas?.setDirty(true)
  }
  const raf = createRafBatch(processPointerMoveFrame)

  const handlePointerMove = (event: PointerEvent) => {
    if (!pointerSession.matches(event)) return
    dragSession.pendingMove = {
      clientX: event.clientX,
      clientY: event.clientY,
      target: event.target
    }
    raf.schedule()
  }

  // Attempt to finalize by connecting to a DOM slot candidate
  const tryConnectToCandidate = (
    candidate: SlotDropCandidate | null
  ): boolean => {
    if (!candidate?.compatible) return false
    const graph = app.canvas?.graph
    const adapter = ensureActiveAdapter()
    if (!graph || !adapter) return false

    const nodeId = Number(candidate.layout.nodeId)
    const targetNode = graph.getNodeById(nodeId)
    if (!targetNode) return false

    if (candidate.layout.type === 'input') {
      const inputSlot = targetNode.inputs?.[candidate.layout.index]
      return (
        !!inputSlot &&
        connectLinksToInput(adapter.renderLinks, targetNode, inputSlot)
      )
    }

    if (candidate.layout.type === 'output') {
      const outputSlot = targetNode.outputs?.[candidate.layout.index]
      return (
        !!outputSlot &&
        connectLinksToOutput(adapter.renderLinks, targetNode, outputSlot)
      )
    }

    return false
  }

  // Attempt to finalize by dropping on a reroute under the pointer
  const tryConnectViaRerouteAtPointer = (): boolean => {
    const rerouteLayout = layoutStore.queryRerouteAtPoint({
      x: state.pointer.canvas.x,
      y: state.pointer.canvas.y
    })
    const graph = app.canvas?.graph
    const adapter = ensureActiveAdapter()
    if (!rerouteLayout || !graph || !adapter) return false

    const reroute = graph.getReroute(rerouteLayout.id)
    if (!reroute || !adapter.isRerouteValidDrop(reroute.id)) return false

    let didConnect = false

    const results = reroute.findTargetInputs() ?? []
    const maybeReroutes = reroute.getReroutes()
    if (results.length && maybeReroutes !== null) {
      const originalReroutes = maybeReroutes.slice(0, -1).reverse()
      for (const link of adapter.renderLinks) {
        if (!isToInputLink(link)) continue
        for (const result of results) {
          link.connectToRerouteInput(
            reroute,
            result,
            adapter.linkConnector.events,
            originalReroutes
          )
          didConnect = true
        }
      }
    }

    const sourceOutput = reroute.findSourceOutput()
    if (sourceOutput) {
      const { node, output } = sourceOutput
      for (const link of adapter.renderLinks) {
        if (!isToOutputLink(link)) continue
        if (hasCanConnectToReroute(link) && !link.canConnectToReroute(reroute))
          continue
        link.connectToRerouteOutput(
          reroute,
          node,
          output,
          adapter.linkConnector.events
        )
        didConnect = true
      }
    }

    return didConnect
  }

  const finishInteraction = (event: PointerEvent) => {
    if (!pointerSession.matches(event)) return
    event.preventDefault()

    raf.flush()

    if (!state.source) {
      cleanupInteraction()
      app.canvas?.setDirty(true)
      return
    }

    // Prefer using the snapped candidate captured during hover for perf + consistency
    const snappedCandidate = state.candidate?.compatible
      ? state.candidate
      : null

    let connected = tryConnectToCandidate(snappedCandidate)

    // Fallback to DOM slot under pointer (if any), then node fallback, then reroute
    if (!connected) {
      const domCandidate = candidateFromTarget(event.target)
      connected = tryConnectToCandidate(domCandidate)
    }

    if (!connected) {
      const nodeCandidate = candidateFromNodeTarget(event.target)
      connected = tryConnectToCandidate(nodeCandidate)
    }

    if (!connected) connected = tryConnectViaRerouteAtPointer() || connected

    // Drop on canvas: disconnect moving input link(s)
    if (!connected && !snappedCandidate && state.source.type === 'input') {
      ensureActiveAdapter()?.disconnectMovingLinks()
    }

    cleanupInteraction()
    app.canvas?.setDirty(true)
  }

  const handlePointerUp = (event: PointerEvent) => {
    finishInteraction(event)
  }

  const handlePointerCancel = (event: PointerEvent) => {
    if (!pointerSession.matches(event)) return

    raf.flush()
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

    ensureActiveAdapter()
    raf.cancel()
    dragSession.reset()

    const layout = layoutStore.getSlotLayout(
      getSlotKey(nodeId, index, type === 'input')
    )
    if (!layout) return

    const numericNodeId = Number(nodeId)
    const isInputSlot = type === 'input'
    const isOutputSlot = type === 'output'

    const resolvedNode = graph.getNodeById(numericNodeId)
    const inputSlot = isInputSlot ? resolvedNode?.inputs?.[index] : undefined
    const outputSlot = isOutputSlot ? resolvedNode?.outputs?.[index] : undefined

    const ctrlOrMeta = event.ctrlKey || event.metaKey

    const inputLinkId = inputSlot?.link ?? null
    const inputFloatingCount = inputSlot?._floatingLinks?.size ?? 0
    const hasExistingInputLink = inputLinkId != null || inputFloatingCount > 0

    const outputLinkCount = outputSlot?.links?.length ?? 0
    const outputFloatingCount = outputSlot?._floatingLinks?.size ?? 0
    const hasExistingOutputLink = outputLinkCount > 0 || outputFloatingCount > 0

    const shouldBreakExistingInputLink =
      isInputSlot &&
      hasExistingInputLink &&
      ctrlOrMeta &&
      event.altKey &&
      !event.shiftKey

    const existingInputLink =
      isInputSlot && inputLinkId != null
        ? graph.getLink(inputLinkId)
        : undefined

    if (shouldBreakExistingInputLink && resolvedNode) {
      resolvedNode.disconnectInput(index, true)
    }

    const baseDirection = isInputSlot
      ? inputSlot?.dir ?? LinkDirection.LEFT
      : outputSlot?.dir ?? LinkDirection.RIGHT

    const existingAnchor =
      isInputSlot && !shouldBreakExistingInputLink
        ? resolveExistingInputLinkAnchor(graph, inputSlot)
        : null

    const shouldMoveExistingOutput =
      isOutputSlot && event.shiftKey && hasExistingOutputLink

    const shouldMoveExistingInput =
      isInputSlot && !shouldBreakExistingInputLink && hasExistingInputLink

    const adapter = ensureActiveAdapter()
    if (adapter) {
      if (isOutputSlot) {
        adapter.beginFromOutput(numericNodeId, index, {
          moveExisting: shouldMoveExistingOutput
        })
      } else {
        adapter.beginFromInput(numericNodeId, index, {
          moveExisting: shouldMoveExistingInput
        })
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
        linkId: !shouldBreakExistingInputLink
          ? existingInputLink?.id
          : undefined,
        movingExistingOutput: shouldMoveExistingOutput
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
