import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import type {
  INodeInputSlot,
  INodeOutputSlot,
  ReadOnlyPoint
} from '@/lib/litegraph/src/interfaces'
import { LinkDirection } from '@/lib/litegraph/src/types/globalEnums'
import { resolveConnectingLinkColor } from '@/lib/litegraph/src/utils/linkColors'
import { createLinkConnectorAdapter } from '@/renderer/core/canvas/links/linkConnectorAdapter'
import {
  type SlotDragSource,
  useSlotLinkDragState
} from '@/renderer/core/canvas/links/slotLinkDragState'
import type { LinkRenderContext } from '@/renderer/core/canvas/litegraph/litegraphLinkAdapter'
import { getSlotKey } from '@/renderer/core/layout/slots/slotIdentifier'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'

function buildContext(canvas: LGraphCanvas): LinkRenderContext {
  return {
    renderMode: canvas.links_render_mode,
    connectionWidth: canvas.connections_width,
    renderBorder: canvas.render_connections_border,
    lowQuality: canvas.low_quality,
    highQualityRender: canvas.highquality_render,
    scale: canvas.ds.scale,
    linkMarkerShape: canvas.linkMarkerShape,
    renderConnectionArrows: canvas.render_connection_arrows,
    highlightedLinks: new Set(Object.keys(canvas.highlighted_links)),
    defaultLinkColor: canvas.default_link_color,
    linkTypeColors: (canvas.constructor as typeof LGraphCanvas)
      .link_type_colors,
    disabledPattern: canvas._pattern
  }
}

export function attachSlotLinkPreviewRenderer(canvas: LGraphCanvas) {
  const originalOnDrawForeground = canvas.onDrawForeground?.bind(canvas)
  const patched = (
    ctx: CanvasRenderingContext2D,
    area: LGraphCanvas['visible_area']
  ) => {
    originalOnDrawForeground?.(ctx, area)

    const { state } = useSlotLinkDragState()
    if (!state.active || !state.source) return

    const { pointer, source } = state

    const linkRenderer = canvas.linkRenderer
    if (!linkRenderer) return
    const context = buildContext(canvas)

    // Prefer LinkConnector render links when available (multi-link drags, move-existing, reroutes)
    const adapter = createLinkConnectorAdapter()
    const renderLinks = adapter?.renderLinks
    if (adapter && renderLinks && renderLinks.length > 0) {
      const to: ReadOnlyPoint = [pointer.canvas.x, pointer.canvas.y]
      ctx.save()
      for (const link of renderLinks) {
        // Prefer Vue slot layout position for accuracy in Vue Nodes mode
        let fromPoint = link.fromPos
        const nodeId = (link.node as any)?.id
        if (typeof nodeId === 'number') {
          const isInputFrom = link.toType === 'output'
          const key = getSlotKey(
            String(nodeId),
            link.fromSlotIndex,
            isInputFrom
          )
          const layout = layoutStore.getSlotLayout(key)
          if (layout) fromPoint = [layout.position.x, layout.position.y]
        }

        const colour = resolveConnectingLinkColor(link.fromSlot.type)
        const startDir = link.fromDirection ?? LinkDirection.RIGHT
        const endDir = link.dragDirection ?? LinkDirection.CENTER

        linkRenderer.renderDraggingLink(
          ctx,
          fromPoint,
          to,
          colour,
          startDir,
          endDir,
          context
        )
      }
      ctx.restore()
      return
    }

    // Fallback to legacy single-link preview based on composable state
    const start = source.position
    const sourceSlot = resolveSourceSlot(canvas, source)
    const from: ReadOnlyPoint = [start.x, start.y]
    const to: ReadOnlyPoint = [pointer.canvas.x, pointer.canvas.y]
    const startDir = source.direction ?? LinkDirection.RIGHT
    const endDir = LinkDirection.CENTER
    const colour = resolveConnectingLinkColor(sourceSlot?.type)
    ctx.save()
    linkRenderer.renderDraggingLink(
      ctx,
      from,
      to,
      colour,
      startDir,
      endDir,
      context
    )
    ctx.restore()
  }

  canvas.onDrawForeground = patched
}

function resolveSourceSlot(
  canvas: LGraphCanvas,
  source: SlotDragSource
): INodeInputSlot | INodeOutputSlot | undefined {
  const graph = canvas.graph
  if (!graph) return undefined

  const nodeId = Number(source.nodeId)
  if (!Number.isFinite(nodeId)) return undefined

  const node = graph.getNodeById(nodeId)
  if (!node) return undefined

  return source.type === 'output'
    ? node.outputs?.[source.slotIndex]
    : node.inputs?.[source.slotIndex]
}
