import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import type { RenderLink } from '@/lib/litegraph/src/canvas/RenderLink'
import type { ReadOnlyPoint } from '@/lib/litegraph/src/interfaces'
import { LinkDirection } from '@/lib/litegraph/src/types/globalEnums'
import { resolveConnectingLinkColor } from '@/lib/litegraph/src/utils/linkColors'
import { createLinkConnectorAdapter } from '@/renderer/core/canvas/links/linkConnectorAdapter'
import { useSlotLinkDragState } from '@/renderer/core/canvas/links/slotLinkDragState'
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
    // If LiteGraph's own connector is active, let it handle rendering to avoid double-draw
    if (canvas.linkConnector?.isConnecting) return
    if (!state.active || !state.source) return

    const { pointer } = state

    const linkRenderer = canvas.linkRenderer
    if (!linkRenderer) return
    const context = buildContext(canvas)

    const renderLinks = createLinkConnectorAdapter()?.renderLinks
    if (!renderLinks || renderLinks.length === 0) return

    const to: ReadOnlyPoint = state.candidate?.compatible
      ? [state.candidate.layout.position.x, state.candidate.layout.position.y]
      : [pointer.canvas.x, pointer.canvas.y]
    ctx.save()
    for (const link of renderLinks) {
      const startDir = link.fromDirection ?? LinkDirection.RIGHT
      const endDir = link.dragDirection ?? LinkDirection.CENTER
      const colour = resolveConnectingLinkColor(link.fromSlot.type)

      const fromPoint = resolveRenderLinkOrigin(link)

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
  }

  canvas.onDrawForeground = patched
}

function resolveRenderLinkOrigin(link: RenderLink): ReadOnlyPoint {
  if (link.fromReroute) {
    const rerouteLayout = layoutStore.getRerouteLayout(link.fromReroute.id)
    if (rerouteLayout) {
      return [rerouteLayout.position.x, rerouteLayout.position.y]
    }

    const [x, y] = link.fromReroute.pos
    return [x, y]
  }

  const nodeId = getRenderLinkNodeId(link)
  if (nodeId != null) {
    const isInputFrom = link.toType === 'output'
    const key = getSlotKey(String(nodeId), link.fromSlotIndex, isInputFrom)
    const layout = layoutStore.getSlotLayout(key)
    if (layout) {
      return [layout.position.x, layout.position.y]
    }
  }

  return link.fromPos
}

function getRenderLinkNodeId(link: RenderLink): number | null {
  const node = link.node
  if (typeof node === 'object' && node !== null && 'id' in node) {
    const maybeId = node.id
    if (typeof maybeId === 'number') return maybeId
  }
  return null
}
