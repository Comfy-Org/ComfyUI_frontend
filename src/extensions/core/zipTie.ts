import { t } from '@/i18n'
import {
  clearLinkSelection,
  getSelectedLinkIds,
  selectLinksInMarquee
} from '@/lib/litegraph/src/canvas/linkSelection'
import { resolvePointerTarget } from '@/lib/litegraph/src/canvas/resolvePointerTarget'
import { CanvasPointer } from '@/lib/litegraph/src/CanvasPointer'
import { ContextMenu } from '@/lib/litegraph/src/ContextMenu'
import type { LGraphCanvas, LGraph } from '@/lib/litegraph/src/litegraph'
import type { CanvasPointerEvent } from '@comfyorg/graph-model/events'
import type { PointTuple as Point } from '@comfyorg/shared-frontend-utils/geometry'
import { moveRerouteLayout } from '@/renderer/core/layout/operations/graphLayoutAttachment'
import { app } from '@/scripts/app'
import { useLinkSelectionStore } from '@/stores/linkSelectionStore'
import type { ComfyExtension } from '@/types/comfy'

import {
  createZipTie,
  getZipTies,
  releaseZipTie,
  resolveZipTie,
  zipTieBounds
} from './zipTieRouting'
import type { ZipTie } from './zipTieRouting'

function canEdit(canvas: LGraphCanvas): boolean {
  return !canvas.read_only && !canvas.selectOnly && canvas.allow_interaction
}

function isZipTieMarquee(event: MouseEvent): boolean {
  return (
    event.button === 0 &&
    event.metaKey &&
    event.shiftKey &&
    !event.ctrlKey &&
    !event.altKey
  )
}

function beginZipTieMarquee(
  canvas: LGraphCanvas,
  event: CanvasPointerEvent,
  finish: () => void
): boolean {
  const { graph, pointer } = canvas
  if (
    !graph ||
    !event.isPrimary ||
    !canEdit(canvas) ||
    !isZipTieMarquee(event) ||
    canvas.dragging_canvas
  )
    return false
  const origin: Point = [event.canvasX, event.canvasY]
  const node = graph.getNodeOnPos(...origin) ?? undefined
  const target = resolvePointerTarget(canvas, graph, event, node)
  if (!['empty', 'group', 'link', 'linkCentre'].includes(target.kind))
    return false

  event.preventDefault()
  event.stopPropagation()
  pointer.onDragStart = () => {
    canvas.dragging_rectangle = [...origin, 0, 0]
  }
  pointer.onDragEnd = (upEvent) => {
    if (canvas.graph !== graph || !canEdit(canvas) || !isZipTieMarquee(upEvent))
      return
    selectLinksInMarquee(
      canvas,
      [
        Math.min(origin[0], upEvent.canvasX),
        Math.min(origin[1], upEvent.canvasY),
        Math.abs(upEvent.canvasX - origin[0]),
        Math.abs(upEvent.canvasY - origin[1])
      ],
      upEvent.canvasX
    )
    bundleSelectedLinks(canvas)
  }
  pointer.finally = () => {
    canvas.dragging_rectangle = null
    canvas.setDirty(true, true)
    finish()
  }
  return true
}

function tieAtPoint(canvas: LGraphCanvas, [x, y]: Point) {
  const { graph } = canvas
  if (!graph) return
  return getZipTies(graph).find((tie) => {
    const reroutes = resolveZipTie(graph, tie)
    if (!reroutes.length) return false
    const bounds = zipTieBounds(reroutes)
    const padding = 4 / canvas.ds.scale
    return (
      x >= bounds.x - padding &&
      x <= bounds.x + bounds.width + padding &&
      y >= bounds.y - padding &&
      y <= bounds.y + bounds.height + padding
    )
  })
}

function bundleSelectedLinks(canvas: LGraphCanvas, position?: Point): void {
  const { graph } = canvas
  const selection = useLinkSelectionStore().selection
  if (!graph || !selection || !canEdit(canvas)) return
  const links = getSelectedLinkIds(graph).flatMap((id) => {
    const link = graph.getLink(id)
    return link ? [link] : []
  })
  if (links.length < 2) return
  const { marquee } = selection
  canvas.emitBeforeChange()
  try {
    createZipTie(
      graph,
      links,
      position ?? [
        marquee.x + marquee.width / 2,
        marquee.y + marquee.height / 2
      ]
    )
    clearLinkSelection(canvas)
    canvas.setDirty(true, true)
  } finally {
    canvas.emitAfterChange()
  }
}

function releaseTie(canvas: LGraphCanvas, graph: LGraph, tie: ZipTie) {
  if (canvas.graph !== graph || !canEdit(canvas)) return
  canvas.emitBeforeChange()
  try {
    releaseZipTie(graph, tie)
    canvas.setDirty(true, true)
  } finally {
    canvas.emitAfterChange()
  }
}

function beginZipTieDrag(
  canvas: LGraphCanvas,
  pointer: CanvasPointer,
  graph: LGraph,
  tie: ZipTie,
  event: PointerEvent
) {
  canvas.adjustMouseEvent(event)
  pointer.down(event)
  const origin = canvas.convertEventToCanvasOffset(event)
  const positions = resolveZipTie(graph, tie).map((reroute) => ({
    reroute,
    x: reroute.pos[0],
    y: reroute.pos[1]
  }))
  function move(event: MouseEvent) {
    const point = canvas.convertEventToCanvasOffset(event)
    for (const { reroute, x, y } of positions)
      moveRerouteLayout(reroute, {
        x: x + point[0] - origin[0],
        y: y + point[1] - origin[1]
      })
    canvas.setDirty(true, true)
  }
  pointer.onDragStart = () => canvas.emitBeforeChange()
  pointer.onDrag = (event) => {
    if (pointer.dragStarted) move(event)
  }
  pointer.onDragEnd = (event) => {
    move(event)
    canvas.emitAfterChange()
  }
  pointer.onDragCancel = () => {
    for (const { reroute, x, y } of positions)
      moveRerouteLayout(reroute, { x, y })
    canvas.emitAfterChange()
  }
  function update(event: PointerEvent) {
    if (event.pointerId !== pointer.pointerId) return
    event.preventDefault()
    event.stopImmediatePropagation()
    if (canvas.graph !== graph || !canEdit(canvas)) {
      pointer.reset()
      return
    }
    canvas.adjustMouseEvent(event)
    if (event.type === 'pointermove') pointer.move(event)
    else if (event.type === 'pointerup') pointer.up(event)
    else pointer.reset()
  }
  const gestureController = new AbortController()
  const gestureOptions = { capture: true, signal: gestureController.signal }
  for (const type of ['pointermove', 'pointerup', 'pointercancel'] as const)
    canvas.canvas.ownerDocument.addEventListener(type, update, gestureOptions)
  pointer.finally = () => {
    gestureController.abort()
    canvas.setDirty(true, true)
  }
}

export function installZipTieInteraction(canvas: LGraphCanvas): () => void {
  const document = canvas.canvas.ownerDocument
  const controller = new AbortController()
  const options = { capture: true, signal: controller.signal }
  const pointer = new CanvasPointer(canvas.canvas)
  let marqueePointer: CanvasPointer | undefined
  const originalMouse = canvas.onMouse
  canvas.onMouse = function (event) {
    if (originalMouse?.call(this, event)) return true
    const started = beginZipTieMarquee(canvas, event, () => {
      marqueePointer = undefined
    })
    if (started) marqueePointer = canvas.pointer
    return started
  }

  function start(event: PointerEvent) {
    if (
      event.target !== canvas.canvas ||
      !canEdit(canvas) ||
      canvas.dragging_canvas ||
      (event.button !== 0 && event.button !== 2)
    )
      return
    const graph = canvas.graph
    const origin = canvas.convertEventToCanvasOffset(event)
    const tie = tieAtPoint(canvas, origin)
    if (!graph || !tie) return
    event.preventDefault()
    event.stopImmediatePropagation()
    canvas.canvas.focus()
    if (event.button === 2) {
      pointer.reset()
      new ContextMenu(
        [
          {
            content: t('zipTie.release'),
            callback: () => releaseTie(canvas, graph, tie)
          }
        ],
        { event }
      )
      return
    }
    beginZipTieDrag(canvas, pointer, graph, tie, event)
  }

  document.addEventListener('pointerdown', start, options)
  document.addEventListener(
    'keydown',
    (event) => {
      const activePointer = marqueePointer ?? pointer
      if (activePointer.pointerId === undefined || event.key !== 'Escape')
        return
      event.preventDefault()
      event.stopImmediatePropagation()
      activePointer.reset()
    },
    options
  )

  const originalDraw = canvas.onDrawForeground
  canvas.onDrawForeground = function (ctx, area) {
    originalDraw?.call(this, ctx, area)
    if (!canvas.graph) return
    const hovered = tieAtPoint(canvas, canvas.graph_mouse)
    ctx.save()
    for (const tie of getZipTies(canvas.graph)) {
      const reroutes = resolveZipTie(canvas.graph, tie)
      if (!reroutes.length) continue
      const { x, y, width, height } = zipTieBounds(reroutes)
      ctx.fillStyle =
        hovered?.rerouteIds[0] === tie.rerouteIds[0]
          ? canvas.default_link_color
          : canvas.clear_background_color
      ctx.strokeStyle = canvas.node_title_color
      ctx.lineWidth = 2 / canvas.ds.scale
      ctx.beginPath()
      ctx.roundRect(x, y, width, height, 4)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = canvas.node_title_color
      ctx.fillRect(x + 5, y + 4, width - 10, 3)
    }
    ctx.restore()
  }

  return () => {
    marqueePointer?.reset()
    pointer.reset()
    controller.abort()
    canvas.onMouse = originalMouse
    canvas.onDrawForeground = originalDraw
  }
}

export const zipTieExtension: ComfyExtension = {
  name: 'Comfy.ZipTie',
  commands: [
    {
      id: 'Comfy.Canvas.ZipTieSelectedLinks',
      label: () => t('zipTie.bundle'),
      icon: 'icon-[lucide--cable]',
      mutatesGraph: true,
      function: () => bundleSelectedLinks(app.canvas)
    }
  ],
  setup() {
    const dispose = installZipTieInteraction(app.canvas)
    import.meta.hot?.dispose(dispose)
  },
  getCanvasMenuItems(canvas) {
    const position: Point = [canvas.graph_mouse[0], canvas.graph_mouse[1]]
    return [
      {
        content: t('zipTie.bundle'),
        disabled:
          !canEdit(canvas) ||
          !canvas.graph ||
          getSelectedLinkIds(canvas.graph).length < 2,
        callback: () => bundleSelectedLinks(canvas, position)
      }
    ]
  }
}
