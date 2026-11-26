import type { LGraph } from '@/lib/litegraph/src/litegraph'
import {
  calculateMinimapScale,
  calculateNodeBounds
} from '@/renderer/core/spatial/boundsCalculator'

import { MinimapDataSource } from '@/renderer/extensions/minimap/data/MinimapDataSource'
import { renderMinimapToCanvas } from '@/renderer/extensions/minimap/minimapCanvasRenderer'

/**
 * Render a graph to a thumbnail data URL.
 * Used by workflow thumbnail generation.
 */
export function createGraphThumbnail(
  graph: LGraph | null | undefined
): string | null {
  if (!graph || graph._nodes.length === 0) {
    return null
  }

  const width = 250
  const height = 200

  const bounds = calculateNodeBounds(graph._nodes)
  if (!bounds) {
    return null
  }

  const scale = calculateMinimapScale(bounds, width, height)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  renderMinimapToCanvas(canvas, new MinimapDataSource(graph), {
    bounds,
    scale,
    settings: {
      nodeColors: true,
      showLinks: false,
      showGroups: true,
      renderBypass: false,
      renderError: false
    },
    width,
    height
  })

  const dataUrl = canvas.toDataURL()

  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, width, height)
  }

  return dataUrl
}
