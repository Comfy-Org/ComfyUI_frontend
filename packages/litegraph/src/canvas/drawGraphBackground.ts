import type {
  LGraphCanvas,
  LGraphNode,
  LGraph,
  Subgraph
} from '@comfyorg/graph-model/entityRegistry'
import type { Rect } from '@comfyorg/shared-frontend-utils/geometry'

function drawBackgroundImage(
  lgCanvas: LGraphCanvas,
  ctx: CanvasRenderingContext2D,
  source: string
): void {
  ctx.globalAlpha = lgCanvas.zoom_modify_alpha
    ? (1.0 - 0.5 / lgCanvas.ds.scale) * lgCanvas.editor_alpha
    : lgCanvas.editor_alpha
  ctx.imageSmoothingEnabled = false
  if (!lgCanvas._bg_img || lgCanvas._bg_img.name != source) {
    lgCanvas._bg_img = new Image()
    lgCanvas._bg_img.name = source
    lgCanvas._bg_img.src = source
    lgCanvas._bg_img.addEventListener('load', () => {
      lgCanvas.draw(true, true)
    })
  }
  let pattern = lgCanvas._pattern
  if (pattern == null && lgCanvas._bg_img.width > 0) {
    pattern = ctx.createPattern(lgCanvas._bg_img, 'repeat') ?? undefined
    lgCanvas._pattern_img = lgCanvas._bg_img
    lgCanvas._pattern = pattern
  }
  if (pattern) {
    const [x, y, width, height] = lgCanvas.visible_area
    ctx.fillStyle = pattern
    ctx.fillRect(x, y, width, height)
    ctx.fillStyle = 'transparent'
  }
  ctx.globalAlpha = 1.0
  ctx.imageSmoothingEnabled = true
}

function drawBackdrop(
  lgCanvas: LGraphCanvas,
  ctx: CanvasRenderingContext2D,
  backgroundPainted: boolean
): void {
  const [x, y, width, height] = lgCanvas.visible_area
  if (
    lgCanvas.ds.scale < 1.5 &&
    !backgroundPainted &&
    lgCanvas.clear_background_color
  ) {
    ctx.fillStyle = lgCanvas.clear_background_color
    ctx.fillRect(x, y, width, height)
  }
  if (
    lgCanvas.background_image &&
    lgCanvas.ds.scale > 0.5 &&
    !backgroundPainted
  )
    drawBackgroundImage(lgCanvas, ctx, lgCanvas.background_image)
  if (lgCanvas.bg_tint) {
    ctx.fillStyle = lgCanvas.bg_tint
    ctx.fillRect(x, y, width, height)
    ctx.fillStyle = 'transparent'
  }
}

export function drawGraphBackground(
  lgCanvas: LGraphCanvas,
  ctx: CanvasRenderingContext2D,
  dpr: number,
  viewportRect: Rect | undefined,
  nodesInFrameOrder: LGraphNode[] | undefined,
  nodesGraph: LGraph | Subgraph | null
): void {
  const { canvas } = ctx
  const viewport = viewportRect || [0, 0, canvas.width, canvas.height]
  if (lgCanvas.clear_background)
    ctx.clearRect(viewport[0], viewport[1], viewport[2], viewport[3])
  const backgroundPainted = lgCanvas.onRenderBackground
    ? lgCanvas.onRenderBackground(canvas, ctx)
    : false
  if (!viewportRect) {
    ctx.restore()
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  if (!lgCanvas.graph) return
  ctx.save()
  lgCanvas.ds.toCanvasContext(ctx)
  drawBackdrop(lgCanvas, ctx, backgroundPainted)
  if (lgCanvas.graph._groups.length) lgCanvas.drawGroups(canvas, ctx)
  lgCanvas.onDrawBackground?.(ctx, lgCanvas.visible_area)
  if (lgCanvas.render_canvas_border) {
    ctx.strokeStyle = '#235'
    ctx.strokeRect(0, 0, canvas.width, canvas.height)
  }
  if (lgCanvas.render_connections_shadows) {
    ctx.shadowColor = '#000'
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0
    ctx.shadowBlur = 6
  } else {
    ctx.shadowColor = 'rgba(0,0,0,0)'
  }
  lgCanvas.drawConnections(ctx, nodesInFrameOrder, nodesGraph)
  ctx.shadowColor = 'rgba(0,0,0,0)'
  ctx.restore()
}
