import type { LGraph } from '@/lib/litegraph/src/litegraph'
import {
  calculateMinimapScale,
  calculateNodeBounds
} from '@/renderer/core/spatial/boundsCalculator'

import { renderMinimapToCanvas } from '../../extensions/minimap/minimapCanvasRenderer'

/** Configuration options for {@link createTemplateScreenshot}. */
export interface TemplateScreenshotOptions {
  /** Output image width in pixels. @defaultValue 1920 */
  width?: number
  /** Output image height in pixels. @defaultValue 1080 */
  height?: number
  /** Render group rectangles behind nodes. @defaultValue true */
  showGroups?: boolean
  /** Render connection lines between nodes. @defaultValue true */
  showLinks?: boolean
  /** Use per-node background colours. @defaultValue true */
  nodeColors?: boolean
  /** Image MIME type passed to `canvas.toBlob`. @defaultValue 'image/png' */
  mimeType?: string
  /** Image quality (0-1) for lossy formats like `image/jpeg`. */
  quality?: number
}

const DEFAULT_WIDTH = 1920
const DEFAULT_HEIGHT = 1080

/**
 * Renders a high-resolution screenshot of a workflow graph suitable for
 * template marketplace previews.
 *
 * Uses the minimap renderer to draw a simplified but complete overview of
 * every node, group, and connection onto an off-screen canvas, then
 * converts the result to a {@link Blob}.
 *
 * @param graph - The LiteGraph instance to capture.
 * @param options - Optional rendering and output settings.
 * @returns A `Blob` containing the rendered image, or `null` when the
 *          graph is empty or canvas creation fails.
 */
export function createTemplateScreenshot(
  graph: LGraph,
  options: TemplateScreenshotOptions = {}
): Promise<Blob | null> {
  const {
    width = DEFAULT_WIDTH,
    height = DEFAULT_HEIGHT,
    showGroups = true,
    showLinks = true,
    nodeColors = true,
    mimeType = 'image/png',
    quality
  } = options

  if (!graph._nodes || graph._nodes.length === 0) {
    return Promise.resolve(null)
  }

  const bounds = calculateNodeBounds(graph._nodes)
  if (!bounds) {
    return Promise.resolve(null)
  }

  const scale = calculateMinimapScale(bounds, width, height)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  renderMinimapToCanvas(canvas, graph, {
    bounds,
    scale,
    settings: {
      nodeColors,
      showLinks,
      showGroups,
      renderBypass: true,
      renderError: true
    },
    width,
    height
  })

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(
      (blob) => {
        const ctx = canvas.getContext('2d')
        if (ctx) ctx.clearRect(0, 0, width, height)
        resolve(blob)
      },
      mimeType,
      quality
    )
  })
}
