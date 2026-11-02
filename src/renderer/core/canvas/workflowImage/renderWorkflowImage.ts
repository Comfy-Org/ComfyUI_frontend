import type {
  HasBoundingRect,
  ReadOnlyRect
} from '@comfyorg/shared-frontend-utils/geometry'
import { toNodeId } from '@comfyorg/graph-model/nodeId'

import type {
  LGraph,
  LGraphCanvas,
  Subgraph
} from '@/lib/litegraph/src/litegraph'
import { createBounds } from '@/lib/litegraph/src/litegraph'
import { createElementRasterizer } from '@/renderer/core/canvas/workflowImage/rasterizeElement'

const GRAPH_PADDING = 64
const NODE_PADDING = 32
const MAX_CANVAS_SIDE = 16_384
const MAX_CANVAS_AREA = 16_384 * 16_384

type DrawableMedia = HTMLImageElement | HTMLVideoElement | HTMLCanvasElement

function graphBounds(canvas: LGraphCanvas): ReadOnlyRect | null {
  const { graph, subgraph } = canvas
  if (!graph) return null
  const items: HasBoundingRect[] = [...graph.positionableItems()]
  if (subgraph) items.push(subgraph.inputNode, subgraph.outputNode)
  return createBounds(items, GRAPH_PADDING)
}

function exportPixelRatio(width: number, height: number): number {
  return Math.min(
    window.devicePixelRatio || 1,
    MAX_CANVAS_SIDE / width,
    MAX_CANVAS_SIDE / height,
    Math.sqrt(MAX_CANVAS_AREA / (width * height))
  )
}

function nodeElements(canvas: LGraphCanvas): HTMLElement[] {
  const root = canvas.canvas.parentElement
  if (!root) return []
  const elements = [
    ...root.querySelectorAll<HTMLElement>('.lg-node[data-node-id]')
  ]
  const zIndex = (element: HTMLElement) => Number(element.style.zIndex) || 0
  return elements.sort((a, b) => zIndex(a) - zIndex(b))
}

function graphPosition(element: HTMLElement): [number, number] {
  const transform = new DOMMatrixReadOnly(getComputedStyle(element).transform)
  return [transform.m41, transform.m42]
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
): ReadOnlyRect {
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

function drawNodeMedia(
  ctx: CanvasRenderingContext2D,
  element: HTMLElement,
  [nodeX, nodeY]: [number, number],
  scale: number
) {
  const elementRect = element.getBoundingClientRect()
  const media = element.querySelectorAll<DrawableMedia>('img, video, canvas')

  ctx.save()
  ctx.globalAlpha = Number(getComputedStyle(element).opacity)
  for (const item of media) {
    const size = mediaSize(item)
    if (!size[0] || !size[1]) continue

    const rect = item.getBoundingClientRect()
    if (!rect.width || !rect.height) continue

    const box: ReadOnlyRect = [
      nodeX + (rect.left - elementRect.left) / scale,
      nodeY + (rect.top - elementRect.top) / scale,
      rect.width / scale,
      rect.height / scale
    ]
    const [x, y, width, height] = fitMedia(
      getComputedStyle(item).objectFit,
      size,
      box
    )
    ctx.drawImage(item, x, y, width, height)
  }
  ctx.restore()
}

interface PositionedElement {
  element: HTMLElement
  x: number
  y: number
}

function overlaps(a: PositionedElement, b: PositionedElement): boolean {
  return (
    a.x < b.x + b.element.offsetWidth &&
    b.x < a.x + a.element.offsetWidth &&
    a.y < b.y + b.element.offsetHeight &&
    b.y < a.y + a.element.offsetHeight
  )
}

function batchBelowMedia(
  elements: readonly PositionedElement[]
): PositionedElement[][] {
  const batches: PositionedElement[][] = [[]]
  let mediaInBatch: PositionedElement[] = []
  for (const positioned of elements) {
    if (mediaInBatch.some((media) => overlaps(media, positioned))) {
      batches.push([])
      mediaInBatch = []
    }
    batches[batches.length - 1].push(positioned)
    if (positioned.element.querySelector('img, video, canvas'))
      mediaInBatch.push(positioned)
  }
  return batches
}

async function prepareWidgets(
  graph: LGraph | Subgraph,
  clone: HTMLElement,
  source: HTMLElement
) {
  const { nodeId } = source.dataset
  const node = nodeId ? graph.getNodeById(toNodeId(nodeId)) : null
  if (!node?.widgets) return

  const cloneRows = clone.querySelectorAll<HTMLElement>('[data-widget-name]')
  const sourceRows = source.querySelectorAll<HTMLElement>('[data-widget-name]')
  for (const [index, sourceRow] of sourceRows.entries()) {
    const cloneRow = cloneRows[index]
    const name = sourceRow.dataset.widgetName
    const widget = node.widgets.find((widget) => widget.name === name)
    if (!widget?.prepareImageExport) continue

    try {
      await widget.prepareImageExport(cloneRow, sourceRow)
    } catch (error) {
      console.error(
        `Widget "${name}" failed to prepare for workflow image export`,
        error
      )
    }
  }
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
}

export async function renderWorkflowImage(
  canvas: LGraphCanvas
): Promise<Blob | null> {
  const { graph } = canvas
  const bounds = graphBounds(canvas)
  if (!graph || !bounds) return null

  const [left, top, width, height] = bounds
  const pixelRatio = exportPixelRatio(width, height)
  const output = document.createElement('canvas')
  output.width = Math.ceil(width * pixelRatio)
  output.height = Math.ceil(height * pixelRatio)
  const ctx = output.getContext('2d')
  if (!ctx) return null

  canvas.drawGraphImage(ctx, bounds, pixelRatio)

  const positioned = nodeElements(canvas).map((element) => {
    const [x, y] = graphPosition(element)
    return { element, x, y }
  })
  const viewScale = canvas.ds.scale
  const rasterizer = createElementRasterizer()
  ctx.setTransform(
    pixelRatio,
    0,
    0,
    pixelRatio,
    -left * pixelRatio,
    -top * pixelRatio
  )
  for (const batch of batchBelowMedia(positioned)) {
    const rasterized = await rasterizer.rasterize(batch, {
      padding: NODE_PADDING,
      pixelRatio,
      prepareClone: (clone, source) => prepareWidgets(graph, clone, source)
    })
    if (rasterized) {
      const { image, x, y, width, height } = rasterized
      ctx.drawImage(image, x, y, width, height)
    }
    for (const { element, x, y } of batch)
      drawNodeMedia(ctx, element, [x, y], viewScale)
  }

  return canvasToBlob(output)
}
