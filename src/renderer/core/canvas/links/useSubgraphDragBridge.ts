import { tryOnScopeDispose, whenever } from '@vueuse/core'
import { storeToRefs } from 'pinia'

import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import type { LGraphNode, NodeId } from '@/lib/litegraph/src/LGraphNode'
import type { LinkConnector } from '@/lib/litegraph/src/canvas/LinkConnector'
import type { RenderLink } from '@/lib/litegraph/src/canvas/RenderLink'
import type { SlotDropCandidate } from '@/renderer/core/canvas/links/slotLinkDragUIState'
import { LinkDirection } from '@/lib/litegraph/src/types/globalEnums'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { createLinkConnectorAdapter } from '@/renderer/core/canvas/links/linkConnectorAdapter'
import {
  resolveNodeSurfaceSlotCandidate,
  resolveSlotTargetCandidate
} from '@/renderer/core/canvas/links/linkDropOrchestrator'
import { useSlotLinkDragUIState } from '@/renderer/core/canvas/links/slotLinkDragUIState'
import { getSlotKey } from '@/renderer/core/layout/slots/slotIdentifier'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { createSlotLinkDragContext } from '@/renderer/extensions/vueNodes/composables/slotLinkDragContext'
import { resolvePointerTarget } from '@/renderer/extensions/vueNodes/composables/useSlotLinkInteraction'
import { useNodeSlotRegistryStore } from '@/renderer/extensions/vueNodes/stores/nodeSlotRegistryStore'
import { createRafBatch } from '@/utils/rafBatch'

const SNAP_CLASS = 'lg-slot--snap-target'

/**
 * Bridges canvas-initiated subgraph IO drags to Vue slot drag state.
 *
 * When a drag starts from a SubgraphInput or SubgraphOutput node
 * (canvas-drawn), the Vue slot components need to know about it so they
 * can dim incompatible slots, snap links, and highlight compatible targets.
 */
export function useSubgraphDragBridge() {
  const canvasStore = useCanvasStore()
  const { canvas } = storeToRefs(canvasStore)
  const {
    state: dragState,
    beginDrag,
    endDrag,
    setCandidate,
    setCompatibleForKey
  } = useSlotLinkDragUIState()
  let cleanup: (() => void) | undefined

  whenever(canvas, (lgCanvas) => {
    cleanup?.()
    cleanup = setupBridge(lgCanvas)
  })

  tryOnScopeDispose(() => {
    cleanup?.()
    cleanup = undefined
  })

  /** Wires up LinkConnector event listeners and returns a cleanup function. */
  function setupBridge(lgCanvas: LGraphCanvas): () => void {
    const linkConnector: LinkConnector = lgCanvas.linkConnector
    let pointerTracking: { cleanup: () => void; flush: () => void } | undefined
    let isBridgeDrag = false

    const onConnecting = (
      event: CustomEvent<{ connectingTo: 'input' | 'output' }>
    ) => {
      pointerTracking?.cleanup()
      pointerTracking = undefined

      const { connectingTo } = event.detail

      const adapter = createLinkConnectorAdapter()
      if (!adapter) return

      const renderLink = adapter.renderLinks[0]
      if (!renderLink) return

      const sourceType: 'input' | 'output' =
        connectingTo === 'input' ? 'output' : 'input'

      isBridgeDrag = true
      beginDrag(
        {
          nodeId: String(renderLink.node.id),
          slotIndex: renderLink.fromSlotIndex,
          type: sourceType,
          direction: renderLink.fromDirection ?? LinkDirection.RIGHT,
          position: {
            x: renderLink.fromPos[0],
            y: renderLink.fromPos[1]
          }
        },
        -1
      )

      const allKeys = layoutStore.getAllSlotKeys()
      for (const key of allKeys) {
        const slotLayout = layoutStore.getSlotLayout(key)
        if (!slotLayout) continue
        if (slotLayout.type !== connectingTo) continue

        const ok =
          connectingTo === 'input'
            ? adapter.isInputValidDrop(slotLayout.nodeId, slotLayout.index)
            : adapter.isOutputValidDrop(slotLayout.nodeId, slotLayout.index)

        setCompatibleForKey(key, ok)
      }

      pointerTracking = startPointerTracking(lgCanvas, linkConnector)
    }

    const onBeforeDropOnCanvas = (event: CustomEvent) => {
      if (!isBridgeDrag) return

      pointerTracking?.flush()
      const candidate = dragState.candidate
      if (!candidate?.compatible) return

      const adapter = createLinkConnectorAdapter()
      if (!adapter) return

      const connected = connectToCandidate(
        adapter.renderLinks,
        adapter.network,
        candidate,
        linkConnector
      )
      if (connected) event.preventDefault()
    }

    const onReset = () => {
      if (!isBridgeDrag) return
      pointerTracking?.cleanup()
      pointerTracking = undefined
      isBridgeDrag = false
      endDrag()
    }

    linkConnector.events.addEventListener('connecting', onConnecting)
    linkConnector.events.addEventListener(
      'before-drop-on-canvas',
      onBeforeDropOnCanvas
    )
    linkConnector.events.addEventListener('reset', onReset)

    return () => {
      linkConnector.events.removeEventListener('connecting', onConnecting)
      linkConnector.events.removeEventListener(
        'before-drop-on-canvas',
        onBeforeDropOnCanvas
      )
      linkConnector.events.removeEventListener('reset', onReset)
      pointerTracking?.cleanup()
      pointerTracking = undefined
      if (isBridgeDrag) {
        isBridgeDrag = false
        endDrag()
      }
    }
  }

  /**
   * Tracks pointer movement during a bridge drag to resolve Vue slot
   * candidates, update snap positions, and toggle snap-target highlights.
   */
  function startPointerTracking(
    lgCanvas: LGraphCanvas,
    linkConnector: LinkConnector
  ): { cleanup: () => void; flush: () => void } {
    const ownerDoc = lgCanvas.getCanvasWindow().document
    const ownerView = ownerDoc.defaultView
    const session = createSlotLinkDragContext()
    const slotRegistry = useNodeSlotRegistryStore()
    let pendingMove: { clientX: number; clientY: number } | null = null
    let highlightedSlotEl: HTMLElement | null = null

    /** Resolves the Vue slot under the pointer and updates snap/highlight state. */
    const processFrame = () => {
      const data = pendingMove
      if (!data) return
      pendingMove = null

      const adapter = createLinkConnectorAdapter()
      if (!adapter) return
      const graph = adapter.network

      const target = resolvePointerTarget(
        data.clientX,
        data.clientY,
        null,
        ownerDoc
      )

      let hoveredSlotKey: string | null = null
      let hoveredNodeId: NodeId | null = null
      if (target === session.lastPointerEventTarget) {
        hoveredSlotKey = session.lastPointerTargetSlotKey
        hoveredNodeId = session.lastPointerTargetNodeId
      } else if (ownerView && target instanceof ownerView.HTMLElement) {
        const elWithSlot = target
          .closest('.lg-slot, .lg-node-widget')
          ?.querySelector<HTMLElement>('[data-slot-key]')
        const elWithNode = target.closest<HTMLElement>('[data-node-id]')
        hoveredSlotKey = elWithSlot?.dataset['slotKey'] ?? null
        hoveredNodeId = elWithNode?.dataset['nodeId'] ?? null
        session.lastPointerEventTarget = target
        session.lastPointerTargetSlotKey = hoveredSlotKey
        session.lastPointerTargetNodeId = hoveredNodeId
      }

      const hoverChanged =
        hoveredSlotKey !== session.lastHoverSlotKey ||
        hoveredNodeId !== session.lastHoverNodeId
      // Recompute node-surface candidates even without a hover change when
      // the pointer is on a node background (no specific slot hovered).
      const shouldResolveCandidate =
        hoverChanged || (hoveredSlotKey == null && hoveredNodeId != null)

      let candidate = dragState.candidate

      if (shouldResolveCandidate) {
        const context = { adapter, graph, session }
        const slotCandidate = resolveSlotTargetCandidate(target, context)
        const nodeCandidate = resolveNodeSurfaceSlotCandidate(target, context)
        candidate = slotCandidate?.compatible ? slotCandidate : nodeCandidate
        session.lastHoverSlotKey = hoveredSlotKey
        session.lastHoverNodeId = hoveredNodeId

        if (slotCandidate) {
          const key = getSlotKey(
            slotCandidate.layout.nodeId,
            slotCandidate.layout.index,
            slotCandidate.layout.type === 'input'
          )
          setCompatibleForKey(key, !!slotCandidate.compatible)
        }
        if (nodeCandidate && !slotCandidate?.compatible) {
          const key = getSlotKey(
            nodeCandidate.layout.nodeId,
            nodeCandidate.layout.index,
            nodeCandidate.layout.type === 'input'
          )
          setCompatibleForKey(key, !!nodeCandidate.compatible)
        }
      }

      const newCandidate = candidate?.compatible ? candidate : null
      const newCandidateKey = newCandidate
        ? getSlotKey(
            newCandidate.layout.nodeId,
            newCandidate.layout.index,
            newCandidate.layout.type === 'input'
          )
        : null

      const candidateChanged = newCandidateKey !== session.lastCandidateKey
      if (candidateChanged) {
        setCandidate(newCandidate)
        session.lastCandidateKey = newCandidateKey
        updateSnapTargetHighlight(newCandidate)
      }

      const snapPos = newCandidate
        ? ([newCandidate.layout.position.x, newCandidate.layout.position.y] as [
            number,
            number
          ])
        : undefined
      const currentSnap = linkConnector.state.snapLinksPos
      const snapPosChanged = snapPos
        ? !currentSnap ||
          currentSnap[0] !== snapPos[0] ||
          currentSnap[1] !== snapPos[1]
        : !!currentSnap
      if (snapPosChanged) {
        linkConnector.state.snapLinksPos = snapPos
      }

      if (candidateChanged || snapPosChanged) {
        lgCanvas.setDirty(true, true)
      }
    }

    /** Toggles the `lg-slot--snap-target` CSS class on the candidate's slot element. */
    function updateSnapTargetHighlight(candidate: SlotDropCandidate | null) {
      if (highlightedSlotEl) {
        highlightedSlotEl.classList.remove(SNAP_CLASS)
        highlightedSlotEl = null
      }
      if (!candidate) return
      const key = getSlotKey(
        candidate.layout.nodeId,
        candidate.layout.index,
        candidate.layout.type === 'input'
      )
      const entry = slotRegistry
        .getNode(candidate.layout.nodeId)
        ?.slots.get(key)
      const groupEl =
        (entry?.el?.closest('.group\\/slot') as HTMLElement | null) ??
        entry?.el?.parentElement
      if (groupEl) {
        groupEl.classList.add(SNAP_CLASS)
        highlightedSlotEl = groupEl
      }
    }

    const raf = createRafBatch(processFrame)

    /** Buffers the latest pointer position and schedules a RAF frame. */
    const onPointerMove = (e: PointerEvent) => {
      pendingMove = { clientX: e.clientX, clientY: e.clientY }
      raf.schedule()
    }

    ownerDoc.addEventListener('pointermove', onPointerMove, { capture: true })

    return {
      flush: () => raf.flush(),
      cleanup: () => {
        ownerDoc.removeEventListener('pointermove', onPointerMove, {
          capture: true
        })
        raf.cancel()
        if (highlightedSlotEl) {
          highlightedSlotEl.classList.remove(SNAP_CLASS)
          highlightedSlotEl = null
        }
        session.dispose()
      }
    }
  }
}

/**
 * Connects render links to the snapped Vue slot candidate.
 * Returns `true` if at least one link was connected.
 */
function connectToCandidate(
  links: ReadonlyArray<RenderLink>,
  network: { getNodeById(id: NodeId): LGraphNode | null },
  candidate: SlotDropCandidate,
  linkConnector: LinkConnector
): boolean {
  const node = network.getNodeById(candidate.layout.nodeId)
  if (!node) return false

  let connected = false

  if (candidate.layout.type === 'input') {
    const input = node.inputs?.[candidate.layout.index]
    if (!input) return false
    for (const link of links) {
      if (link.toType !== 'input') continue
      if (!link.canConnectToInput(node, input)) continue
      link.connectToInput(node, input, linkConnector.events)
      connected = true
    }
  } else {
    const output = node.outputs?.[candidate.layout.index]
    if (!output) return false
    for (const link of links) {
      if (link.toType !== 'output') continue
      if (!link.canConnectToOutput(node, output)) continue
      link.connectToOutput(node, output, linkConnector.events)
      connected = true
    }
  }

  return connected
}
