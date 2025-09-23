import { type Fn, useEventListener } from '@vueuse/core'
import log from 'loglevel'
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
      const canvas = app.canvas
      const graph = canvas?.graph
      adapter ??= createLinkConnectorAdapter()
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
    }

    return candidate
  }

  const conversion = useSharedCanvasPositionConversion()

  const pointerSession = createPointerSession()
  let adapter: LinkConnectorAdapter | null = null

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
    let didConnect = false
    for (const link of links) {
      if (!isInputConnectableLink(link)) continue
      if (!link.canConnectToInput(node, inputSlot)) continue
      link.connectToInput(node, inputSlot, adapter?.linkConnector.events)
      didConnect = true
    }
    return didConnect
  }

  function connectLinksToOutput(
    links: ReadonlyArray<RenderLink>,
    node: LGraphNode,
    outputSlot: INodeOutputSlot
  ): boolean {
    let didConnect = false
    for (const link of links) {
      if (!isOutputConnectableLink(link)) continue
      if (!link.canConnectToOutput(node, outputSlot)) continue
      link.connectToOutput(node, outputSlot, adapter?.linkConnector.events)
      didConnect = true
    }
    return didConnect
  }

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

  const cleanupInteraction = () => {
    adapter?.reset()
    pointerSession.clear()
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
    if (!pointerSession.matches(event)) return
    updatePointerState(event)
    app.canvas?.setDirty(true)
  }

  const finishInteraction = (event: PointerEvent) => {
    if (!pointerSession.matches(event)) return
    event.preventDefault()

    if (state.source) {
      const candidate = candidateFromTarget(event.target)
      let connected = false
      if (candidate?.compatible) {
        const canvas = app.canvas
        const graph = canvas?.graph
        if (graph) {
          adapter ??= createLinkConnectorAdapter()
          const targetNode = graph.getNodeById(Number(candidate.layout.nodeId))
          if (adapter && targetNode) {
            if (candidate.layout.type === 'input') {
              const inputSlot = targetNode.inputs?.[candidate.layout.index]
              if (
                inputSlot &&
                connectLinksToInput(adapter.renderLinks, targetNode, inputSlot)
              )
                connected = true
            } else if (candidate.layout.type === 'output') {
              const outputSlot = targetNode.outputs?.[candidate.layout.index]
              if (
                outputSlot &&
                connectLinksToOutput(
                  adapter.renderLinks,
                  targetNode,
                  outputSlot
                )
              )
                connected = true
            }
          }
        }
      }

      // Try reroute drop when no DOM slot was detected
      if (!connected) {
        const rerouteLayout = layoutStore.queryRerouteAtPoint({
          x: state.pointer.canvas.x,
          y: state.pointer.canvas.y
        })
        const graph = app.canvas?.graph
        adapter ??= createLinkConnectorAdapter()
        if (rerouteLayout && graph && adapter) {
          const reroute = graph.getReroute(rerouteLayout.id)
          if (reroute && adapter.isRerouteValidDrop(reroute.id)) {
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
                  connected = true
                }
              }
            }

            const sourceOutput = reroute.findSourceOutput()
            if (sourceOutput) {
              const { node, output } = sourceOutput
              for (const link of adapter.renderLinks) {
                if (!isOutputConnectableLink(link)) continue
                if (
                  hasCanConnectToReroute(link) &&
                  !link.canConnectToReroute(reroute)
                )
                  continue
                link.connectToRerouteOutput(
                  reroute,
                  node,
                  output,
                  adapter.linkConnector.events
                )
                connected = true
              }
            }
          }
        }
      }

      // Drop on canvas: disconnect moving input link(s)
      if (!connected && !candidate && state.source.type === 'input') {
        adapter ??= createLinkConnectorAdapter()
        adapter?.disconnectMovingLinks()
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

    adapter ??= createLinkConnectorAdapter()
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
