import type { Point2D as Point } from '@comfyorg/shared-frontend-utils/geometry'
import { useEventListener, useRafFn } from '@vueuse/core'
import { computed, readonly, ref, shallowRef } from 'vue'

import type {
  NodeId,
  PortRef,
  SuperGraphDocument
} from '@/renderer/extensions/superComfy/engine/documentSchema'
import {
  canConnect,
  findNode,
  incomingEdges,
  portsOf
} from '@/renderer/extensions/superComfy/engine/graphTopology'
import type {
  ConnectOutcome,
  EditEvent
} from '@/renderer/extensions/superComfy/engine/types'

import {
  PORT_HIT_RADIUS,
  hitPort,
  portAnchor,
  portIndex
} from './canvasGeometry'
import type { PortSide } from './canvasGeometry'

export interface DraftLink {
  from: PortRef
  start: Point
  end: Point
}

interface PointerLike {
  clientX: number
  clientY: number
}

interface CanvasGestureOptions {
  doc: () => SuperGraphDocument
  toWorld: (event: PointerLike) => Point
  dispatch: (event: EditEvent) => void
  connect: (from: PortRef, to: PortRef) => ConnectOutcome
  removeNodes: (ids: readonly NodeId[]) => void
  startPan: (event: PointerEvent) => void
}

interface NodeDrag {
  start: Point
  pointer: Point
  applied: Point
  origins: { id: NodeId; x: number; y: number }[]
}

const INTERACTIVE_SELECTOR =
  'input, textarea, select, button, a, video, audio, [role="combobox"], [role="slider"], [contenteditable="true"], [data-no-drag]'

function isInteractiveTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element && target.closest(INTERACTIVE_SELECTOR) !== null
  )
}

function portKey(nodeId: NodeId, port: string): string {
  return `${nodeId}\u0000${port}`
}

export function useCanvasGestures(options: CanvasGestureOptions) {
  const selection = shallowRef<ReadonlySet<NodeId>>(new Set())
  const draft = ref<DraftLink | null>(null)
  const draftFrom = shallowRef<PortRef | null>(null)
  let nodeDrag: NodeDrag | null = null

  const compatiblePorts = computed(() => {
    const from = draftFrom.value
    if (!from) return new Set<string>()
    const doc = options.doc()
    return new Set(
      doc.nodes.flatMap((node) =>
        portsOf(node)
          .inputs.filter(
            (port) =>
              canConnect(doc, from, { node: node.id, port: port.name }).ok
          )
          .map((port) => portKey(node.id, port.name))
      )
    )
  })

  const draftActive = computed(() => draftFrom.value !== null)

  function isCompatible(nodeId: NodeId, port: string): boolean {
    return compatiblePorts.value.has(portKey(nodeId, port))
  }

  function select(nodeId: NodeId, additive: boolean) {
    const current = selection.value
    if (!additive) {
      if (!current.has(nodeId)) selection.value = new Set([nodeId])
      return
    }
    selection.value = current.has(nodeId)
      ? new Set([...current].filter((id) => id !== nodeId))
      : new Set([...current, nodeId])
  }

  function clearSelection() {
    if (selection.value.size > 0) selection.value = new Set()
  }

  function selectOnly(nodeId: NodeId) {
    selection.value = new Set([nodeId])
  }

  function flushDrag() {
    const drag = nodeDrag
    if (!drag) return
    if (drag.pointer.x === drag.applied.x && drag.pointer.y === drag.applied.y)
      return
    const dx = drag.pointer.x - drag.start.x
    const dy = drag.pointer.y - drag.start.y
    options.dispatch({
      type: 'nodesMoved',
      moves: drag.origins.map(({ id, x, y }) => ({ id, x: x + dx, y: y + dy }))
    })
    nodeDrag = { ...drag, applied: drag.pointer }
  }

  const dragFrame = useRafFn(flushDrag, { immediate: false })

  function beginNodeDrag(event: PointerEvent) {
    const start = options.toWorld(event)
    nodeDrag = {
      start,
      pointer: start,
      applied: start,
      origins: options
        .doc()
        .nodes.filter(({ id }) => selection.value.has(id))
        .map(({ id, x, y }) => ({ id, x, y }))
    }
    dragFrame.resume()
    const stopMove = useEventListener(window, 'pointermove', (move) => {
      if (nodeDrag) nodeDrag = { ...nodeDrag, pointer: options.toWorld(move) }
    })
    useEventListener(
      window,
      'pointerup',
      () => {
        stopMove()
        flushDrag()
        dragFrame.pause()
        nodeDrag = null
      },
      { once: true }
    )
  }

  function onNodePointerDown(event: PointerEvent, nodeId: NodeId) {
    if (event.button === 1) {
      event.preventDefault()
      options.startPan(event)
      return
    }
    if (event.button !== 0) return
    if (isInteractiveTarget(event.target)) {
      select(nodeId, false)
      return
    }
    select(nodeId, event.shiftKey)
    if (selection.value.has(nodeId)) beginNodeDrag(event)
  }

  function finishLink(event: PointerLike) {
    const current = draft.value
    draft.value = null
    draftFrom.value = null
    if (!current) return
    const target = hitPort(
      options.doc(),
      options.toWorld(event),
      PORT_HIT_RADIUS,
      'in'
    )
    if (target) options.connect(current.from, target)
  }

  function startLink(from: PortRef, event: PointerEvent) {
    const node = findNode(options.doc(), from.node)
    if (!node) return
    const start = portAnchor(node, 'out', portIndex(node, 'out', from.port))
    draft.value = { from, start, end: options.toWorld(event) }
    draftFrom.value = from
    const stopMove = useEventListener(window, 'pointermove', (move) => {
      if (draft.value)
        draft.value = { ...draft.value, end: options.toWorld(move) }
    })
    useEventListener(
      window,
      'pointerup',
      (up) => {
        stopMove()
        finishLink(up)
      },
      { once: true }
    )
  }

  function pickUpEdge(nodeId: NodeId, port: string, event: PointerEvent) {
    const wired = incomingEdges(options.doc(), nodeId, port).at(-1)
    if (!wired) return
    options.dispatch({ type: 'edgesRemoved', edgeIds: [wired.id] })
    startLink(wired.from, event)
  }

  function onPortPointerDown(
    event: PointerEvent,
    nodeId: NodeId,
    side: PortSide,
    port: string
  ) {
    if (event.button !== 0) return
    event.stopPropagation()
    event.preventDefault()
    if (side === 'out') startLink({ node: nodeId, port }, event)
    else pickUpEdge(nodeId, port, event)
  }

  function onBackgroundPointerDown(event: PointerEvent) {
    if (event.button !== 0 && event.button !== 1) return
    event.preventDefault()
    if (event.button === 0 && !event.shiftKey) clearSelection()
    options.startPan(event)
  }

  function deleteSelection() {
    const ids = [...selection.value]
    if (ids.length === 0) return
    options.removeNodes(ids)
    selection.value = new Set()
  }

  return {
    selection: readonly(selection),
    draft: readonly(draft),
    draftActive,
    isCompatible,
    onNodePointerDown,
    onPortPointerDown,
    onBackgroundPointerDown,
    clearSelection,
    selectOnly,
    deleteSelection
  }
}
