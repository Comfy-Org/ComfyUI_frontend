import { type Fn, useEventListener } from '@vueuse/core'
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
import {
  type SlotDropCandidate,
  useSlotLinkDragState
} from '@/renderer/core/canvas/links/slotLinkDragState'
import { getSlotKey } from '@/renderer/core/layout/slots/slotIdentifier'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import type { Point } from '@/renderer/core/layout/types'
import { toPoint } from '@/renderer/core/layout/utils/geometry'
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

  const { state, beginDrag, endDrag, updatePointerPosition, setCandidate } =
    useSlotLinkDragState()

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
      if (layout.type === 'input') {
        candidate.compatible = adapter.isInputValidDrop(
          layout.nodeId,
          layout.index
        )
      } else if (layout.type === 'output') {
        candidate.compatible = adapter.isOutputValidDrop(
          layout.nodeId,
          layout.index
        )
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
    const node = graph.getNodeById(nodeId)
    if (!node) return null

    const firstLink = adapter.renderLinks[0]
    if (!firstLink) return null
    const connectingTo = adapter.linkConnector.state.connectingTo

    if (connectingTo === 'input') {
      const res = node.findInputByType(firstLink.fromSlot.type)
      const index = res?.index
      if (index == null) return null
      const key = getSlotKey(String(nodeId), index, true)
      const layout = layoutStore.getSlotLayout(key)
      if (!layout) return null
      const compatible = adapter.isInputValidDrop(nodeId, index)
      if (!compatible) return null
      return { layout, compatible: true }
    } else if (connectingTo === 'output') {
      const res = node.findOutputByType(firstLink.fromSlot.type)
      const index = res?.index
      if (index == null) return null
      const key = getSlotKey(String(nodeId), index, false)
      const layout = layoutStore.getSlotLayout(key)
      if (!layout) return null
      const compatible = adapter.isOutputValidDrop(nodeId, index)
      if (!compatible) return null
      return { layout, compatible: true }
    }

    return null
  }

  const conversion = useSharedCanvasPositionConversion()

  const pointerSession = createPointerSession()
  let activeAdapter: LinkConnectorAdapter | null = null

  const ensureActiveAdapter = (): LinkConnectorAdapter | null => {
    if (!activeAdapter) activeAdapter = createLinkConnectorAdapter()
    return activeAdapter
  }

  function hasCanConnectToReroute(
    link: RenderLink
  ): link is RenderLink & { canConnectToReroute: (r: Reroute) => boolean } {
    return 'canConnectToReroute' in link
  }

  type InputConnectableLink = RenderLink & {
    toType: 'input'
    canConnectToInput: (node: LGraphNode, input: INodeInputSlot) => boolean
  }

  type OutputConnectableLink = RenderLink & {
    toType: 'output'
    canConnectToOutput: (node: LGraphNode, output: INodeOutputSlot) => boolean
  }

  function isInputConnectableLink(
    link: RenderLink
  ): link is InputConnectableLink {
    return (
      link.toType === 'input' &&
      typeof (link as { canConnectToInput?: unknown }).canConnectToInput ===
        'function'
    )
  }

  function isOutputConnectableLink(
    link: RenderLink
  ): link is OutputConnectableLink {
    return (
      link.toType === 'output' &&
      typeof (link as { canConnectToOutput?: unknown }).canConnectToOutput ===
        'function'
    )
  }

  function connectLinksToInput(
    links: ReadonlyArray<RenderLink>,
    node: LGraphNode,
    inputSlot: INodeInputSlot
  ): boolean {
    const validCandidates = links
      .filter(isInputConnectableLink)
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
      .filter(isOutputConnectableLink)
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

    const adapter = ensureActiveAdapter()
    // Resolve a candidate from slot under cursor, else from node
    const slotCandidate = candidateFromTarget(event.target)
    const nodeCandidate = slotCandidate
      ? null
      : candidateFromNodeTarget(event.target)
    const candidate = slotCandidate ?? nodeCandidate

    // Update drag-state candidate; Vue preview renderer reads this
    if (candidate?.compatible && adapter) {
      setCandidate(candidate)
    } else {
      setCandidate(null)
    }

    app.canvas?.setDirty(true)
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
        if (!isInputConnectableLink(link)) continue
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
        if (!isOutputConnectableLink(link)) continue
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

    if (!state.source) {
      cleanupInteraction()
      app.canvas?.setDirty(true)
      return
    }

    const candidate = candidateFromTarget(event.target)
    let connected = tryConnectToCandidate(candidate)
    if (!connected) connected = tryConnectViaRerouteAtPointer() || connected

    // Drop on canvas: disconnect moving input link(s)
    if (!connected && !candidate && state.source.type === 'input') {
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
