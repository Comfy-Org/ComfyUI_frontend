import type { SmartGuide } from '@comfyorg/graph-model/arrange/snapSolver'
import type { Point2D } from '@comfyorg/shared-frontend-utils/geometry'

type ToScreen = (point: Point2D) => Point2D

function stroke(
  ctx: CanvasRenderingContext2D,
  from: Point2D,
  to: Point2D,
  lineWidth: number
) {
  ctx.lineWidth = lineWidth
  ctx.beginPath()
  ctx.moveTo(from.x, from.y)
  ctx.lineTo(to.x, to.y)
  ctx.stroke()
}

function drawGuide(
  ctx: CanvasRenderingContext2D,
  guide: SmartGuide,
  toScreen: ToScreen
) {
  if (guide.kind === 'wire') {
    ctx.lineCap = 'round'
    stroke(ctx, toScreen(guide.from), toScreen(guide.to), 3)
    ctx.lineCap = 'butt'
    return
  }
  if (guide.kind === 'line') {
    const { axis, at, from, to } = guide
    const [start, end] =
      axis === 'x'
        ? [
            { x: at, y: from },
            { x: at, y: to }
          ]
        : [
            { x: from, y: at },
            { x: to, y: at }
          ]
    stroke(ctx, toScreen(start), toScreen(end), 1)
    return
  }
  const { axis, from, to, cross } = guide
  const [start, end, middle] =
    axis === 'x'
      ? [
          { x: from, y: cross },
          { x: to, y: cross },
          { x: (from + to) / 2, y: cross }
        ]
      : [
          { x: cross, y: from },
          { x: cross, y: to },
          { x: cross, y: (from + to) / 2 }
        ]
  stroke(ctx, toScreen(start), toScreen(end), 1)
  const label = toScreen(middle)
  ctx.textAlign = 'center'
  ctx.fillText(
    String(Math.round(to - from)),
    axis === 'x' ? label.x : label.x + 14,
    axis === 'x' ? label.y - 4 : label.y + 4
  )
}

/** Draws `guides` in screen pixels with the context's current stroke, fill, and font. */
export function drawSmartGuides(
  ctx: CanvasRenderingContext2D,
  guides: readonly SmartGuide[],
  toScreen: ToScreen
) {
  for (const guide of guides) drawGuide(ctx, guide, toScreen)
}
