import type {
  HasBoundingRect,
  PointTuple,
  ReadOnlyRect,
  RectTuple
} from '@comfyorg/shared-frontend-utils/geometry'

import type { LGraph, LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { createBounds } from '@/lib/litegraph/src/measure'
import type { WorkflowImageRender } from '@/platform/workflow/core/services/workflowService'
import { nodesInRenderOrder } from '@/renderer/core/canvas/litegraph/arrangeForLegacyRender'
import { drawGraphBackground } from '@/lib/litegraph/src/canvas/drawGraphBackground'
import { createElementRasterizer } from '@/renderer/core/canvas/workflowImage/rasterizeElement'
import type { PositionedElement } from '@/renderer/core/canvas/workflowImage/rasterizeElement'
import { isDOMWidget } from '@/scripts/domWidget'
import { useDomWidgetStore } from '@/stores/domWidgetStore'
import { anyItemOverlapsRect } from '@/utils/mathUtil'

const GRAPH_PADDING = 64
const NODE_PADDING = 32
const MAX_CANVAS_SIDE = 16_384

type DrawableMedia = HTMLImageElement | HTMLVideoElement | HTMLCanvasElement
type Failure = Extract<WorkflowImageRender, { ok: false }>
type MediaSnapshot = {
  image: HTMLCanvasElement
  bounds: RectTuple
  opacity: number
}

function graphBounds(canvas: LGraphCanvas): ReadOnlyRect | undefined {
  const { graph, subgraph } = canvas
  if (!graph) return undefined
  const items: HasBoundingRect[] = [...graph.positionableItems()]
  if (subgraph) items.push(subgraph.inputNode, subgraph.outputNode)
  return createBounds(items, GRAPH_PADDING) ?? undefined
}

function exportPixelRatio(width: number, height: number): number {
  return Math.min(
    window.devicePixelRatio || 1,
    MAX_CANVAS_SIDE / width,
    MAX_CANVAS_SIDE / height
  )
}

function positionedNodes(
  root: HTMLElement,
  graph: LGraph
): PositionedElement[] | undefined {
  const elements = [
    ...root.querySelectorAll<HTMLElement>('.lg-node[data-node-id]')
  ]
  const ids = new Set(elements.map((element) => element.dataset.nodeId))
  if (graph._nodes.some((node) => !ids.has(String(node.id)))) return undefined
  const zIndex = (element: HTMLElement) => Number(element.style.zIndex) || 0
  return elements
    .sort((a, b) => zIndex(a) - zIndex(b))
    .map((element) => {
      const transform = new DOMMatrixReadOnly(
        getComputedStyle(element).transform
      )
      return {
        element,
        x: transform.m41,
        y: transform.m42,
        width: element.offsetWidth,
        height: element.offsetHeight
      }
    })
}

function positionedWidgets(
  root: HTMLElement,
  graph: LGraph
): PositionedElement[] | undefined {
  const positioned: PositionedElement[] = []
  const states = [...useDomWidgetStore().widgetStates.values()]
    .filter(
      ({ widget, active }) =>
        active &&
        widget.node.graph === graph &&
        !widget.node.flags.collapsed &&
        widget.isVisible()
    )
    .sort((a, b) => a.zIndex - b.zIndex)
  for (const { widget } of states) {
    const element = isDOMWidget(widget)
      ? widget.element
      : root.querySelector<HTMLElement>(
          `[data-widget-id="${CSS.escape(widget.id)}"]`
        )
    if (!element) return undefined
    const margin = widget.margin
    const width = (widget.width ?? widget.node.width) - margin * 2
    const height = (widget.computedHeight ?? 50) - margin * 2
    if (width <= 0 || height <= 0) continue
    positioned.push({
      element,
      x: widget.node.pos[0] + margin,
      y: widget.node.pos[1] + margin + widget.y,
      width,
      height
    })
  }
  return positioned
}

function positionedElements(canvas: LGraphCanvas) {
  const { graph } = canvas
  const root = canvas.canvas.parentElement
  if (!graph || !root) return undefined
  return LiteGraph.vueNodesMode
    ? positionedNodes(root, graph)
    : positionedWidgets(root, graph)
}

function mediaSize(media: DrawableMedia): [number, number] {
  if (media instanceof HTMLImageElement)
    return [media.naturalWidth, media.naturalHeight]
  if (media instanceof HTMLVideoElement)
    return [media.videoWidth, media.videoHeight]
  return [media.width, media.height]
}

function fitMedia(
  objectFit: string,
  [mediaWidth, mediaHeight]: [number, number],
  [x, y, width, height]: ReadOnlyRect
): RectTuple {
  if (objectFit !== 'contain' && objectFit !== 'cover')
    return [x, y, width, height]
  const scale = (objectFit === 'contain' ? Math.min : Math.max)(
    width / mediaWidth,
    height / mediaHeight
  )
  const fittedWidth = mediaWidth * scale
  const fittedHeight = mediaHeight * scale
  return [
    x + (width - fittedWidth) / 2,
    y + (height - fittedHeight) / 2,
    fittedWidth,
    fittedHeight
  ]
}

function isDrawableMedia(element: Element): element is DrawableMedia {
  return (
    element instanceof HTMLImageElement ||
    element instanceof HTMLVideoElement ||
    element instanceof HTMLCanvasElement
  )
}

function snapshotNodeMedia(
  positioned: PositionedElement,
  scale: number
): { ok: true; media: MediaSnapshot[] } | Failure {
  const { element, x, y, width, height } = positioned
  const media = [
    ...element.querySelectorAll<DrawableMedia>('img, video, canvas')
  ]
  if (isDrawableMedia(element)) media.unshift(element)
  const snapshots: MediaSnapshot[] = []
  try {
    const elementRect = element.getBoundingClientRect()
    const opacity = Number(getComputedStyle(element).opacity)
    for (const item of media) {
      const size = mediaSize(item)
      if (size.includes(0)) continue
      const rect = item.getBoundingClientRect()
      const box: ReadOnlyRect =
        item === element
          ? [x, y, width, height]
          : [
              x + (rect.left - elementRect.left) / scale,
              y + (rect.top - elementRect.top) / scale,
              rect.width / scale,
              rect.height / scale
            ]
      if (!box[2] || !box[3]) continue
      const image = document.createElement('canvas')
      image.width = size[0]
      image.height = size[1]
      const ctx = image.getContext('2d')
      if (!ctx) return { ok: false }
      ctx.drawImage(item, 0, 0)
      snapshots.push({
        image,
        bounds: fitMedia(getComputedStyle(item).objectFit, size, box),
        opacity
      })
    }
    return { ok: true, media: snapshots }
  } catch (cause) {
    return { ok: false, cause }
  }
}

function batchBelowMedia(
  elements: readonly PositionedElement[]
): PositionedElement[][] {
  const batches: PositionedElement[][] = [[]]
  let mediaInBatch: { pos: PointTuple; size: PointTuple }[] = []
  for (const positioned of elements) {
    const { x, y, width, height, element } = positioned
    const size: PointTuple = [width, height]
    if (anyItemOverlapsRect(mediaInBatch, [x, y, ...size])) {
      batches.push([])
      mediaInBatch = []
    }
    batches[batches.length - 1].push(positioned)
    if (isDrawableMedia(element) || element.querySelector('img, video, canvas'))
      mediaInBatch.push({ pos: [x, y], size })
  }
  return batches.filter((batch) => batch.length > 0)
}

function drawGraph(
  canvas: LGraphCanvas,
  ctx: CanvasRenderingContext2D,
  area: ReadOnlyRect,
  pixelRatio: number
): { ok: true } | Failure {
  const { graph, ds, visible_area } = canvas
  if (!graph) return { ok: false }
  const scale = ds.scale
  const offset: PointTuple = [ds.offset[0], ds.offset[1]]
  const visibleArea = Array.from(visible_area)
  const minimumFontSize = canvas.min_font_size_for_lod
  try {
    ds.scale = 1
    ds.offset = [-area[0], -area[1]]
    visible_area.set(area)
    canvas.min_font_size_for_lod = 0
    const nodes = nodesInRenderOrder(graph)
    drawGraphBackground(canvas, ctx, pixelRatio, undefined, nodes, graph)
    if (canvas.graph !== graph) return { ok: false }
    ctx.save()
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    ds.toCanvasContext(ctx)
    for (const node of nodes) {
      ctx.save()
      ctx.translate(node.pos[0], node.pos[1])
      canvas.drawNode(node, ctx)
      ctx.restore()
      if (canvas.graph !== graph) return { ok: false }
    }
    canvas.subgraph?.draw(
      ctx,
      canvas.colourGetter,
      undefined,
      canvas.editor_alpha
    )
    ctx.restore()
    return canvas.graph === graph ? { ok: true } : { ok: false }
  } catch (cause) {
    return { ok: false, cause }
  } finally {
    ds.scale = scale
    ds.offset = offset
    visible_area.set(visibleArea)
    canvas.min_font_size_for_lod = minimumFontSize
    canvas.setDirty(true, true)
  }
}

function drawMedia(
  ctx: CanvasRenderingContext2D,
  snapshots: MediaSnapshot[]
): void {
  for (const { image, bounds, opacity } of snapshots) {
    ctx.globalAlpha = opacity
    ctx.drawImage(image, ...bounds)
  }
  ctx.globalAlpha = 1
}

async function encodePng(
  canvas: HTMLCanvasElement
): Promise<WorkflowImageRender> {
  try {
    const image = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/png')
    )
    return image ? { ok: true, image } : { ok: false }
  } catch (cause) {
    return { ok: false, cause }
  }
}

export async function renderWorkflowImage(
  canvas: LGraphCanvas
): Promise<WorkflowImageRender> {
  const bounds = graphBounds(canvas)
  if (!bounds) return { ok: false }
  const [left, top, width, height] = bounds
  const pixelRatio = exportPixelRatio(width, height)
  const output = document.createElement('canvas')
  output.width = Math.ceil(width * pixelRatio)
  output.height = Math.ceil(height * pixelRatio)
  const ctx = output.getContext('2d')
  if (!ctx) return { ok: false }
  const area: ReadOnlyRect = [
    left,
    top,
    output.width / pixelRatio,
    output.height / pixelRatio
  ]
  const drawn = drawGraph(canvas, ctx, area, pixelRatio)
  if (!drawn.ok) return drawn
  const positioned = positionedElements(canvas)
  if (!positioned) return { ok: false }
  const batches = batchBelowMedia(positioned)
  if (batches.length === 0) return encodePng(output)
  const rasterizer = createElementRasterizer()
  const captures = batches.map((batch) => ({
    rasterized: rasterizer.rasterize(batch, {
      padding: NODE_PADDING,
      pixelRatio
    }),
    media: batch.map((element) => snapshotNodeMedia(element, canvas.ds.scale))
  }))
  ctx.setTransform(
    pixelRatio,
    0,
    0,
    pixelRatio,
    -left * pixelRatio,
    -top * pixelRatio
  )
  for (const capture of captures) {
    const rasterized = await capture.rasterized
    if (!rasterized.ok) return rasterized
    ctx.drawImage(rasterized.image, ...rasterized.bounds)
    for (const result of capture.media) {
      if (!result.ok) return result
      drawMedia(ctx, result.media)
    }
  }
  return encodePng(output)
}
