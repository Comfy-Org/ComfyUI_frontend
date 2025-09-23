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
    if (!state.active || !state.source) return

    const { pointer } = state

    const linkRenderer = canvas.linkRenderer
    if (!linkRenderer) return
    const context = buildContext(canvas)

    // Prefer LinkConnector render links when available (multi-link drags, move-existing, reroutes)
    const adapter = createLinkConnectorAdapter()
    const renderLinks = adapter?.renderLinks
    if (!adapter || !renderLinks || renderLinks.length === 0) return

    const uniqueLinks = dedupeRenderLinks(renderLinks)

    const to: ReadOnlyPoint = [pointer.canvas.x, pointer.canvas.y]
    ctx.save()
    for (const link of uniqueLinks) {
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

function dedupeRenderLinks(links: ReadonlyArray<RenderLink>): RenderLink[] {
  const uniqueByKey = new Map<string, RenderLink>()
  const fallback: RenderLink[] = []

  for (const link of links) {
    const key = getRenderLinkKey(link)
    if (!key) {
      fallback.push(link)
      continue
    }

    const existing = uniqueByKey.get(key)
    if (!existing) {
      uniqueByKey.set(key, link)
      continue
    }

    // Prefer links that originate from reroutes to keep anchors stable
    if (!existing.fromReroute && link.fromReroute) {
      uniqueByKey.set(key, link)
    } else if (existing.fromReroute === link.fromReroute) {
      // Prefer the one with an explicit drag direction when both share the same origin
      if (
        (!existing.dragDirection ||
          existing.dragDirection === LinkDirection.CENTER) &&
        link.dragDirection &&
        link.dragDirection !== LinkDirection.CENTER
      ) {
        uniqueByKey.set(key, link)
      }
    }
  }

  return [...uniqueByKey.values(), ...fallback]
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

function getRenderLinkKey(link: RenderLink): string | null {
  const linkId = getUnderlyingLinkId(link)
  if (linkId != null) return `link:${linkId}`

  const rerouteId = link.fromReroute?.id
  if (typeof rerouteId === 'number') {
    return `reroute:${rerouteId}`
  }

  const nodeId = getRenderLinkNodeId(link)
  if (nodeId != null) {
    return `node:${nodeId}:slot:${link.fromSlotIndex}:to:${link.toType}`
  }

  return null
}

function getUnderlyingLinkId(link: RenderLink): number | null {
  const maybeLink = (link as { link?: { id?: unknown } }).link
  const maybeId = maybeLink?.id
  return typeof maybeId === 'number' ? maybeId : null
}
