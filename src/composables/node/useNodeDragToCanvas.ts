import { ref, shallowRef } from 'vue'

import { t } from '@/i18n'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { withNodeAddSource } from '@/platform/telemetry/nodeAdded/nodeAddSource'
import type { NodeAddSource } from '@/platform/telemetry/types'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useLitegraphService } from '@/services/litegraphService'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'

type DragMode = 'click' | 'native'
type WidgetValues = Record<string, string>
type Position = { x: number; y: number }

interface StartDragOptions {
  mode?: DragMode
  widgetValues?: WidgetValues
  source?: NodeAddSource
}

const isDragging = ref(false)
const draggedNode = shallowRef<ComfyNodeDefImpl | null>(null)
const dragMode = ref<DragMode>('click')
const lastNativeDragPosition = shallowRef<Position>()
const pendingWidgetValues = shallowRef<WidgetValues>()
const pendingSource = ref<NodeAddSource>('sidebar_drag')
let listenersSetup = false

// Firefox dragend can report stale clientX/Y and `drag` can fire with
// (0, 0). dragover on the target reliably reports real client coords.
// https://bugzilla.mozilla.org/show_bug.cgi?id=1773886
function trackNativeDragPosition(e: DragEvent) {
  if (dragMode.value !== 'native') return
  if (e.clientX === 0 && e.clientY === 0) return
  lastNativeDragPosition.value = { x: e.clientX, y: e.clientY }
}

function applyWidgetValues(node: LGraphNode, values: WidgetValues) {
  for (const [name, value] of Object.entries(values)) {
    const widget = node.widgets?.find((w) => w.name === name)
    if (!widget) {
      console.error(`Widget ${name} not found on node ${node.type}`)
      useToastStore().add({
        severity: 'warn',
        summary: t('g.warning'),
        detail: t('assetBrowser.failedToSetModelValue')
      })
      continue
    }
    widget.value = value
  }
}

function isOverCanvas(clientX: number, clientY: number): boolean {
  const canvasElement = useCanvasStore().canvas?.canvas as
    | HTMLCanvasElement
    | undefined
  if (!canvasElement) return false
  const rect = canvasElement.getBoundingClientRect()
  return (
    clientX >= rect.left &&
    clientX <= rect.right &&
    clientY >= rect.top &&
    clientY <= rect.bottom
  )
}

// The canvas is full-bleed and sidebar/properties panels are pointer-events-auto
// overlays painted on top of it, so a point inside the canvas rect can still be
// over a panel. Hit-test the actual event target instead, mirroring how native
// drag treats the canvas as its only drop target: releasing over a panel cancels.
function isCanvasTarget(target: EventTarget | null): boolean {
  const canvasElement = useCanvasStore().canvas?.canvas
  return (
    !!canvasElement && target instanceof Node && canvasElement.contains(target)
  )
}

function addNodeAtPosition(clientX: number, clientY: number): boolean {
  const nodeDef = draggedNode.value
  if (!nodeDef) return false
  const canvas = useCanvasStore().canvas
  if (!canvas) return false
  if (!isOverCanvas(clientX, clientY)) return false

  const pos = canvas.convertEventToCanvasOffset({
    clientX,
    clientY
  } as PointerEvent)
  const node = withNodeAddSource(pendingSource.value, () =>
    useLitegraphService().addNodeOnGraph(nodeDef, { pos })
  )
  if (!node) {
    console.error(`Failed to add node to graph: ${nodeDef.name}`)
    useToastStore().add({
      severity: 'error',
      summary: t('g.error'),
      detail: t('assetBrowser.failedToCreateNode')
    })
    return true
  }

  if (pendingWidgetValues.value)
    applyWidgetValues(node, pendingWidgetValues.value)
  canvas.selectItems([node])
  return true
}

function endDrag(e: PointerEvent) {
  if (!isDragging.value || !draggedNode.value) return
  if (dragMode.value !== 'click') return

  try {
    if (isCanvasTarget(e.target)) addNodeAtPosition(e.clientX, e.clientY)
  } finally {
    cancelDrag()
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') cancelDrag()
}

// Prevent LiteGraph's empty-canvas hit-test from deselecting the placed node on pointerup.
function blockCommitPointerDown(e: PointerEvent) {
  if (!isDragging.value || dragMode.value !== 'click') return
  if (!isCanvasTarget(e.target)) return
  e.stopImmediatePropagation()
}

function setupGlobalListeners() {
  if (listenersSetup) return
  listenersSetup = true

  document.addEventListener('pointerdown', blockCommitPointerDown, true)
  document.addEventListener('pointerup', endDrag, true)
  document.addEventListener('keydown', handleKeydown)
  document.addEventListener('dragover', trackNativeDragPosition)
}

function cleanupGlobalListeners() {
  if (!listenersSetup) return
  listenersSetup = false

  document.removeEventListener('pointerdown', blockCommitPointerDown, true)
  document.removeEventListener('pointerup', endDrag, true)
  document.removeEventListener('keydown', handleKeydown)
  document.removeEventListener('dragover', trackNativeDragPosition)
}

function cancelDrag() {
  // isGhostPlacing is shared with litegraph's own ghost-placement event. We
  // both set and clear it only for a click drag, assuming a litegraph ghost and
  // a library click-drag never overlap. If that ever changes, a litegraph reset
  // could flip the flag off mid-drag, re-enable node hit-testing, and reintroduce
  // FE-688 — a dedicated flag OR'd into the inert computed would be needed then.
  if (isDragging.value && dragMode.value === 'click')
    useCanvasStore().isGhostPlacing = false
  isDragging.value = false
  draggedNode.value = null
  dragMode.value = 'click'
  lastNativeDragPosition.value = undefined
  pendingWidgetValues.value = undefined
  pendingSource.value = 'sidebar_drag'
  cleanupGlobalListeners()
}

export function useNodeDragToCanvas() {
  function startDrag(
    nodeDef: ComfyNodeDefImpl,
    {
      mode = 'click',
      widgetValues,
      source = 'sidebar_drag'
    }: StartDragOptions = {}
  ) {
    isDragging.value = true
    draggedNode.value = nodeDef
    dragMode.value = mode
    pendingWidgetValues.value = widgetValues
    pendingSource.value = source
    // Reuse the litegraph ghost-placement flag: Vue nodes render inert while
    // it is set, so the release hit-tests the canvas instead of an existing
    // node's DOM and placement over occupied areas isn't silently cancelled.
    // Only the click path relies on DOM hit-testing; the native path commits
    // via geometric coords, so leave node interaction (its @dragover/@drop)
    // intact during a native drag.
    if (mode === 'click') useCanvasStore().isGhostPlacing = true
    setupGlobalListeners()
  }

  function handleNativeDrop(clientX: number, clientY: number) {
    if (dragMode.value !== 'native') return
    const tracked = lastNativeDragPosition.value
    try {
      addNodeAtPosition(tracked?.x ?? clientX, tracked?.y ?? clientY)
    } finally {
      cancelDrag()
    }
  }

  return {
    isDragging,
    draggedNode,
    pendingWidgetValues,
    startDrag,
    cancelDrag,
    handleNativeDrop
  }
}
