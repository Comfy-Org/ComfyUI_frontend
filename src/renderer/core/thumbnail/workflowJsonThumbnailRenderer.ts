import {
  calculateMinimapScale,
  calculateNodeBounds
} from '@/renderer/core/spatial/boundsCalculator'
import type { PositionedNode } from '@/renderer/core/spatial/boundsCalculator'
import { WorkflowJsonDataSource } from '@/renderer/extensions/minimap/data/WorkflowJsonDataSource'
import type { WorkflowJsonInput } from '@/renderer/extensions/minimap/data/WorkflowJsonDataSource'
import { renderMinimapToCanvas } from '@/renderer/extensions/minimap/minimapCanvasRenderer'

export function renderWorkflowJsonThumbnail(
  workflowJson: WorkflowJsonInput,
  width: number,
  height: number
): string | null {
  const dataSource = new WorkflowJsonDataSource(workflowJson)
  if (!dataSource.hasData()) return null

  const nodes = dataSource.getNodes()
  const compatibleNodes = nodes.map(
    (node): PositionedNode => ({
      pos: [node.x, node.y],
      size: [node.width, node.height]
    })
  )
  const bounds = calculateNodeBounds(compatibleNodes)
  if (!bounds) return null

  const scale = calculateMinimapScale(bounds, width, height)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  renderMinimapToCanvas(canvas, dataSource, {
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
