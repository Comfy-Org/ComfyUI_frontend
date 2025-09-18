import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import type {
  INodeInputSlot,
  INodeOutputSlot,
  ReadOnlyPoint
} from '@/lib/litegraph/src/interfaces'
import { LinkDirection } from '@/lib/litegraph/src/types/globalEnums'
import { resolveConnectingLinkColor } from '@/lib/litegraph/src/utils/linkColors'
import type { LinkRenderContext } from '@/renderer/core/canvas/litegraph/litegraphLinkAdapter'
import {
  type SlotDragSource,
  useSlotLinkDragState
} from '@/renderer/core/linkInteractions/slotLinkDragState'

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
  const originalOnRender = canvas.onRender?.bind(canvas)
  const patched = (
    canvasElement: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D
  ) => {
    originalOnRender?.(canvasElement, ctx)

    const { state } = useSlotLinkDragState()
    if (!state.active || !state.source) return

    const { pointer, source } = state
    const start = source.position
    const sourceSlot = resolveSourceSlot(canvas, source)

    const linkRenderer = canvas.linkRenderer
    if (!linkRenderer) return

    const context = buildContext(canvas)

    const from: ReadOnlyPoint = [start.x, start.y]
    const to: ReadOnlyPoint = [pointer.canvas.x, pointer.canvas.y]

    const startDir = source.direction ?? LinkDirection.RIGHT
    const endDir = LinkDirection.NONE

    const colour = resolveConnectingLinkColor(sourceSlot?.type)

    ctx.save()
    canvas.ds.toCanvasContext(ctx)

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

  canvas.onRender = patched
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
