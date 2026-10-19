import { toLightThemeNodeColor } from '@/renderer/extensions/vueNodes/utils/nodeStyleUtils'
import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { LGraphEventMode } from '@/lib/litegraph/src/litegraph'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'

import { MinimapDataSource } from './data/MinimapDataSource'
import type {
  MinimapNodeData,
  MinimapNodeExecutionState,
  MinimapRenderContext
} from './types'

export const MINIMAP_DECORATION_POP_MS = 260

const BYPASS_COLOR = '#6a246a'

type MinimapColors = ReturnType<typeof readMinimapColors>

let cachedColors: { key: string; colors: MinimapColors } | undefined

function resolveThemeColor(token: string): string {
  const probe = document.createElement('span')
  probe.style.color = `var(--${token})`
  document.body.append(probe)
  const { color } = getComputedStyle(probe)
  probe.remove()
  return color
}

function readMinimapColors(isLightTheme: boolean, activityOutline: string) {
  const primary = resolveThemeColor('primary')
  const mutedForeground = resolveThemeColor('muted-foreground')
  return {
    nodeColor: `color-mix(in srgb, ${primary} 60%, transparent)`,
    nodeColorDefault: resolveThemeColor('muted'),
    linkColor: mutedForeground,
    slotColor: mutedForeground,
    groupColor: `color-mix(in srgb, ${primary} 40%, transparent)`,
    groupColorDefault: mutedForeground,
    bypassColor: BYPASS_COLOR,
    errorColor: '#FF0000',
    runningColor: '#00FF00',
    successColor: '#239B23',
    activityOutlineColor: activityOutline,
    isLightTheme
  }
}

function getMinimapColors(): MinimapColors {
  const colorPaletteStore = useColorPaletteStore()
  const palette = colorPaletteStore.completedActivePalette
  const key = `${palette.id}:${colorPaletteStore.colorScheme}`
  if (cachedColors?.key !== key) {
    cachedColors = {
      key,
      colors: readMinimapColors(
        colorPaletteStore.colorScheme === 'light',
        palette.colors.litegraph_base.NODE_SELECTED_TITLE_COLOR
      )
    }
  }
  return cachedColors.colors
}

/**
 * Get node color based on settings and node properties (Single Responsibility)
 */
function getNodeColor(
  node: MinimapNodeData,
  settings: MinimapRenderContext['settings'],
  colors: MinimapColors
): string {
  if (settings.renderBypass && node.mode === LGraphEventMode.BYPASS) {
    return colors.bypassColor
  }

  if (settings.nodeColors) {
    if (node.bgcolor) {
      return colors.isLightTheme
        ? toLightThemeNodeColor(node.bgcolor)
        : node.bgcolor
    }
    return colors.nodeColorDefault
  }

  return colors.nodeColor
}

function renderGroups(
  ctx: CanvasRenderingContext2D,
  dataSource: MinimapDataSource,
  offsetX: number,
  offsetY: number,
  context: MinimapRenderContext,
  colors: MinimapColors
) {
  const groups = dataSource.getGroups()
  if (groups.length === 0) return

  for (const group of groups) {
    const x = (group.x - context.bounds.minX) * context.scale + offsetX
    const y = (group.y - context.bounds.minY) * context.scale + offsetY
    const w = group.width * context.scale
    const h = group.height * context.scale

    let color = colors.groupColor

    if (context.settings.nodeColors) {
      color = group.color ?? colors.groupColorDefault

      if (colors.isLightTheme) {
        color = `color-mix(in srgb, ${color} 50%, transparent)`
      }
    }

    ctx.fillStyle = color
    ctx.fillRect(x, y, w, h)
  }
}

function renderNodeDecorations(
  ctx: CanvasRenderingContext2D,
  nodes: readonly MinimapNodeData[],
  offsetX: number,
  offsetY: number,
  context: MinimapRenderContext,
  colors: MinimapColors
) {
  const decorations = new Map(
    (context.decorations ?? []).map((decoration) => [
      decoration.target.nodeId,
      decoration
    ])
  )
  if (decorations.size === 0) return

  const now = context.now ?? performance.now()
  ctx.fillStyle = colors.nodeColor
  ctx.strokeStyle = colors.activityOutlineColor
  ctx.lineWidth = 1
  for (const node of nodes) {
    const decoration = decorations.get(node.id)
    if (!decoration) continue
    const elapsed = Math.max(0, now - (decoration.enteredAt ?? now))
    const progress =
      decoration.enter === 'pop'
        ? Math.min(1, elapsed / MINIMAP_DECORATION_POP_MS)
        : 1
    const eased = 1 - (1 - progress) ** 3
    const x = (node.x - context.bounds.minX) * context.scale + offsetX
    const y = (node.y - context.bounds.minY) * context.scale + offsetY
    const width = Math.max(2, node.width * context.scale * eased)
    const height = Math.max(2, node.height * context.scale * eased)
    const centerX = x + (node.width * context.scale) / 2
    const centerY = y + (node.height * context.scale) / 2
    ctx.fillRect(centerX - width / 2, centerY - height / 2, width, height)
    ctx.strokeRect(centerX - width / 2, centerY - height / 2, width, height)
  }
}

/**
 * Render nodes on the minimap with performance optimizations
 */
function renderNodes(
  ctx: CanvasRenderingContext2D,
  dataSource: MinimapDataSource,
  offsetX: number,
  offsetY: number,
  context: MinimapRenderContext,
  colors: MinimapColors
) {
  const nodes = dataSource.getNodes()
  if (nodes.length === 0) return

  ctx.save()

  // Group nodes by color for batch rendering (performance optimization)
  const nodesByColor = new Map<
    string,
    Array<{
      x: number
      y: number
      w: number
      h: number
      hasErrors?: boolean
      executionState?: MinimapNodeExecutionState | null
    }>
  >()

  for (const node of nodes) {
    const x = (node.x - context.bounds.minX) * context.scale + offsetX
    const y = (node.y - context.bounds.minY) * context.scale + offsetY
    const w = node.width * context.scale
    const h = node.height * context.scale

    const color = getNodeColor(node, context.settings, colors)

    if (!nodesByColor.has(color)) {
      nodesByColor.set(color, [])
    }

    nodesByColor.get(color)!.push({
      x,
      y,
      w,
      h,
      hasErrors: node.hasErrors,
      executionState: node.executionState
    })
  }

  // Batch render nodes by color
  for (const [color, nodes] of nodesByColor) {
    ctx.fillStyle = color
    for (const node of nodes) {
      ctx.fillRect(node.x, node.y, node.w, node.h)
    }
  }

  renderNodeDecorations(ctx, nodes, offsetX, offsetY, context, colors)

  ctx.lineWidth = 0.3
  for (const nodes of nodesByColor.values()) {
    for (const node of nodes) {
      if (node.hasErrors && context.settings.renderError) {
        ctx.strokeStyle = colors.errorColor
        ctx.strokeRect(node.x, node.y, node.w, node.h)
      } else if (node.executionState === 'running') {
        ctx.strokeStyle = colors.runningColor
        ctx.strokeRect(node.x, node.y, node.w, node.h)
      } else if (node.executionState === 'finished') {
        ctx.strokeStyle = colors.successColor
        ctx.strokeRect(node.x, node.y, node.w, node.h)
      } else if (
        node.executionState === 'error' &&
        context.settings.renderError
      ) {
        ctx.strokeStyle = colors.errorColor
        ctx.strokeRect(node.x, node.y, node.w, node.h)
      }
    }
  }

  ctx.restore()
}

/**
 * Render connections on the minimap
 */
function renderConnections(
  ctx: CanvasRenderingContext2D,
  dataSource: MinimapDataSource,
  offsetX: number,
  offsetY: number,
  context: MinimapRenderContext,
  colors: MinimapColors
) {
  const links = dataSource.getLinks()
  if (links.length === 0) return

  ctx.strokeStyle = colors.linkColor
  ctx.lineWidth = 0.3

  const slotRadius = Math.max(context.scale, 0.5)
  const connections: Array<{
    x1: number
    y1: number
    x2: number
    y2: number
  }> = []

  for (const link of links) {
    const x1 =
      (link.sourceNode.x - context.bounds.minX) * context.scale + offsetX
    const y1 =
      (link.sourceNode.y - context.bounds.minY) * context.scale + offsetY
    const x2 =
      (link.targetNode.x - context.bounds.minX) * context.scale + offsetX
    const y2 =
      (link.targetNode.y - context.bounds.minY) * context.scale + offsetY

    const outputX = x1 + link.sourceNode.width * context.scale
    const outputY = y1 + link.sourceNode.height * context.scale * 0.2
    const inputX = x2
    const inputY = y2 + link.targetNode.height * context.scale * 0.2

    // Draw connection line
    ctx.beginPath()
    ctx.moveTo(outputX, outputY)
    ctx.lineTo(inputX, inputY)
    ctx.stroke()

    connections.push({ x1: outputX, y1: outputY, x2: inputX, y2: inputY })
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

  const dataSource = new MinimapDataSource(graph, context.nodeProgressStates)

  // Fast path for empty graph
  if (!dataSource.hasData()) {
    return
  }

  const colors = getMinimapColors()
  const offsetX = (context.width - context.bounds.width * context.scale) / 2
  const offsetY = (context.height - context.bounds.height * context.scale) / 2

  // Render in correct order: groups -> links -> nodes
  if (context.settings.showGroups) {
    renderGroups(ctx, dataSource, offsetX, offsetY, context, colors)
  }

  if (context.settings.showLinks) {
    renderConnections(ctx, dataSource, offsetX, offsetY, context, colors)
  }

  renderNodes(ctx, dataSource, offsetX, offsetY, context, colors)
}
