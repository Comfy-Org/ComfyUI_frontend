import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useNodeCanvasImagePreview } from '@/composables/node/useNodeCanvasImagePreview'
import { PREVIEW_ZONE_DEFAULT_HEIGHT } from '@/renderer/extensions/vueNodes/components/imagePreviewLayout'
import { activityInside, previewDisplay } from '@/systems/nodePreviewSystem'

const FRAME_INSET = 4
const NOTHING_SHOWN_ELSEWHERE: ReadonlySet<string> = new Set()

const liveFrames = new WeakMap<LGraphNode, Map<string, HTMLImageElement>>()

function liveFrame(
  node: LGraphNode,
  source: string,
  url: string
): HTMLImageElement {
  const frames = liveFrames.get(node) ?? new Map<string, HTMLImageElement>()
  liveFrames.set(node, frames)
  const current = frames.get(source)
  if (current?.src === url) return current
  const frame = new Image()
  frame.onload = () => node.setDirtyCanvas(true)
  frame.src = url
  frames.set(source, frame)
  return frame
}

function contentBottom(node: LGraphNode): number {
  const slotRows = Math.max(node.inputs.length, node.outputs.length)
  const widgetBottoms = node
    .getLayoutWidgets()
    .map(
      (widget) =>
        widget.y + (widget.computedHeight ?? LiteGraph.NODE_WIDGET_HEIGHT)
    )
  return Math.max(slotRows * LiteGraph.NODE_SLOT_HEIGHT, ...widgetBottoms)
}

function drawFitted(
  ctx: CanvasRenderingContext2D,
  frame: HTMLImageElement,
  [x, y, width, height]: readonly [number, number, number, number]
) {
  if (!frame.naturalWidth || !frame.naturalHeight) return
  const scale = Math.min(
    width / frame.naturalWidth,
    height / frame.naturalHeight
  )
  const drawnWidth = frame.naturalWidth * scale
  const drawnHeight = frame.naturalHeight * scale
  ctx.drawImage(
    frame,
    x + (width - drawnWidth) / 2,
    y + (height - drawnHeight) / 2,
    drawnWidth,
    drawnHeight
  )
}

function drawEmptyZone(
  ctx: CanvasRenderingContext2D,
  node: LGraphNode,
  top: number
) {
  ctx.save()
  ctx.setLineDash([4, 4])
  ctx.strokeStyle = LiteGraph.NODE_DEFAULT_BOXCOLOR
  ctx.strokeRect(
    FRAME_INSET,
    top,
    node.size[0] - FRAME_INSET * 2,
    node.size[1] - top - FRAME_INSET
  )
  ctx.restore()
}

/** Grows a canvas node so the space below its widgets fits an empty preview zone. */
export function fitCanvasPreviewZone(node: LGraphNode): void {
  useNodeCanvasImagePreview().reserveCanvasImagePreview(node)
  const height = node.isSubgraphNode()
    ? contentBottom(node) + FRAME_INSET * 2 + PREVIEW_ZONE_DEFAULT_HEIGHT
    : node.computeSize()[1]
  if (node.size[1] < height) node.setSize([node.size[0], height])
}

/**
 * Draws the live frames running inside a subgraph node, one row per interior
 * source, into the space below its widgets without resizing the node.
 */
export function drawSubgraphActivityPreview(
  node: LGraphNode,
  ctx: CanvasRenderingContext2D
): void {
  const display = previewDisplay(node)
  if (display === 'hidden') return
  const parts = activityInside(node, NOTHING_SHOWN_ELSEWHERE)
  const top = contentBottom(node) + FRAME_INSET
  if (!parts.length) {
    if (display === 'shown') drawEmptyZone(ctx, node, top)
    return
  }

  const width = node.size[0] - FRAME_INSET * 2
  const rowHeight =
    (node.size[1] - top - FRAME_INSET * parts.length) / parts.length
  if (width <= 0 || rowHeight <= 0) return

  for (const [row, { source, url }] of parts.entries()) {
    drawFitted(ctx, liveFrame(node, source, url), [
      FRAME_INSET,
      top + row * (rowHeight + FRAME_INSET),
      width,
      rowHeight
    ])
  }
}
