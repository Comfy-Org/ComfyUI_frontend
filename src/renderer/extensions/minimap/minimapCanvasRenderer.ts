import { LGraph, LGraphEventMode } from '@/lib/litegraph/src/litegraph'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'
import { adjustColor } from '@/utils/colorUtil'

import type { MinimapRenderContext } from './types'

/**
 * Get theme-aware colors for the minimap
 */
function getMinimapColors() {
  const colorPaletteStore = useColorPaletteStore()
  const isLightTheme = colorPaletteStore.completedActivePalette.light_theme

  return {
    nodeColor: isLightTheme ? '#3DA8E099' : '#0B8CE999',
    nodeColorDefault: isLightTheme ? '#D9D9D9' : '#353535',
    linkColor: isLightTheme ? '#616161' : '#B3B3B3',
    slotColor: isLightTheme ? '#616161' : '#B3B3B3',
    groupColor: isLightTheme ? '#A2D3EC' : '#1F547A',
    groupColorDefault: isLightTheme ? '#283640' : '#B3C1CB',
    bypassColor: isLightTheme ? '#DBDBDB' : '#4B184B',
    errorColor: '#FF0000',
    isLightTheme
  }
}

/**
 * Render groups on the minimap
 */
function renderGroups(
  ctx: CanvasRenderingContext2D,
  graph: LGraph,
  offsetX: number,
  offsetY: number,
  context: MinimapRenderContext,
  colors: ReturnType<typeof getMinimapColors>
) {
  if (!graph._groups || graph._groups.length === 0) return

  for (const group of graph._groups) {
    const x = (group.pos[0] - context.bounds.minX) * context.scale + offsetX
    const y = (group.pos[1] - context.bounds.minY) * context.scale + offsetY
    const w = group.size[0] * context.scale
    const h = group.size[1] * context.scale

    let color = colors.groupColor

    if (context.settings.nodeColors) {
      color = group.color ?? colors.groupColorDefault

      if (colors.isLightTheme) {
        color = adjustColor(color, { opacity: 0.5 })
      }
    }

    ctx.fillStyle = color
    ctx.fillRect(x, y, w, h)
  }
}

/**
 * Render nodes on the minimap with performance optimizations
 */
function renderNodes(
  ctx: CanvasRenderingContext2D,
  graph: LGraph,
  offsetX: number,
  offsetY: number,
  context: MinimapRenderContext,
  colors: ReturnType<typeof getMinimapColors>
) {
  if (!graph._nodes || graph._nodes.length === 0) return

  // Group nodes by color for batch rendering
  const nodesByColor = new Map<
    string,
    Array<{ x: number; y: number; w: number; h: number; hasErrors?: boolean }>
  >()

  for (const node of graph._nodes) {
    const x = (node.pos[0] - context.bounds.minX) * context.scale + offsetX
    const y = (node.pos[1] - context.bounds.minY) * context.scale + offsetY
    const w = node.size[0] * context.scale
    const h = node.size[1] * context.scale

    let color = colors.nodeColor

    if (context.settings.renderBypass && node.mode === LGraphEventMode.BYPASS) {
      color = colors.bypassColor
    } else if (context.settings.nodeColors) {
      color = colors.nodeColorDefault

      if (node.bgcolor) {
        color = colors.isLightTheme
          ? adjustColor(node.bgcolor, { lightness: 0.5 })
          : node.bgcolor
      }
    }

    if (!nodesByColor.has(color)) {
      nodesByColor.set(color, [])
    }

    nodesByColor.get(color)!.push({ x, y, w, h, hasErrors: node.has_errors })
  }

  // Batch render nodes by color
  for (const [color, nodes] of nodesByColor) {
    ctx.fillStyle = color
    for (const node of nodes) {
      ctx.fillRect(node.x, node.y, node.w, node.h)
    }
  }

  // Render error outlines if needed
  if (context.settings.renderError) {
    ctx.strokeStyle = colors.errorColor
    ctx.lineWidth = 0.3
    for (const nodes of nodesByColor.values()) {
      for (const node of nodes) {
        if (node.hasErrors) {
          ctx.strokeRect(node.x, node.y, node.w, node.h)
        }
      }
    }
  }
}

/**
 * Render connections on the minimap
 */
function renderConnections(
  ctx: CanvasRenderingContext2D,
  graph: LGraph,
  offsetX: number,
  offsetY: number,
  context: MinimapRenderContext,
  colors: ReturnType<typeof getMinimapColors>
) {
  if (!graph || !graph._nodes) return

  ctx.strokeStyle = colors.linkColor
  ctx.lineWidth = 0.3

  const slotRadius = Math.max(context.scale, 0.5)
  const connections: Array<{
    x1: number
    y1: number
    x2: number
    y2: number
  }> = []

  for (const node of graph._nodes) {
    if (!node.outputs) continue

    const x1 = (node.pos[0] - context.bounds.minX) * context.scale + offsetX
    const y1 = (node.pos[1] - context.bounds.minY) * context.scale + offsetY

    for (const output of node.outputs) {
      if (!output.links) continue

      for (const linkId of output.links) {
        const link = graph.links[linkId]
        if (!link) continue

        const targetNode = graph.getNodeById(link.target_id)
        if (!targetNode) continue

        const x2 =
          (targetNode.pos[0] - context.bounds.minX) * context.scale + offsetX
        const y2 =
          (targetNode.pos[1] - context.bounds.minY) * context.scale + offsetY

        const outputX = x1 + node.size[0] * context.scale
        const outputY = y1 + node.size[1] * context.scale * 0.2
        const inputX = x2
        const inputY = y2 + targetNode.size[1] * context.scale * 0.2

        // Draw connection line
        ctx.beginPath()
        ctx.moveTo(outputX, outputY)
        ctx.lineTo(inputX, inputY)
        ctx.stroke()

        connections.push({ x1: outputX, y1: outputY, x2: inputX, y2: inputY })
      }
    }
  }

  // Render connection slots on top
  ctx.fillStyle = colors.slotColor
  for (const conn of connections) {
    // Output slot
    ctx.beginPath()
    ctx.arc(conn.x1, conn.y1, slotRadius, 0, Math.PI * 2)
    ctx.fill()

    // Input slot
    ctx.beginPath()
    ctx.arc(conn.x2, conn.y2, slotRadius, 0, Math.PI * 2)
    ctx.fill()
  }
}

/**
 * Render a graph to a minimap canvas
 */
export function renderMinimapToCanvas(
  canvas: HTMLCanvasElement,
  graph: LGraph,
  context: MinimapRenderContext
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // Clear canvas
  ctx.clearRect(0, 0, context.width, context.height)

  // Fast path for empty graph
  if (!graph || !graph._nodes || graph._nodes.length === 0) {
    return
  }

  const colors = getMinimapColors()
  const offsetX = (context.width - context.bounds.width * context.scale) / 2
  const offsetY = (context.height - context.bounds.height * context.scale) / 2

  // Render in correct order: groups -> links -> nodes
  if (context.settings.showGroups) {
    renderGroups(ctx, graph, offsetX, offsetY, context, colors)
  }

  if (context.settings.showLinks) {
    renderConnections(ctx, graph, offsetX, offsetY, context, colors)
  }

  renderNodes(ctx, graph, offsetX, offsetY, context, colors)
}
