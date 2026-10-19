/**
 * Path Renderer
 *
 * Pure canvas2D rendering utility with no framework dependencies.
 * Renders bezier curves, straight lines, and linear connections between points.
 * Supports arrows, flow animations, and returns Path2D objects for hit detection.
 * Can be reused in any canvas-based project without modification.
 */

export interface Point {
  x: number
  y: number
}

export type Direction = 'left' | 'right' | 'up' | 'down' | 'none'
export type RenderMode = 'spline' | 'straight' | 'linear'
export type ArrowShape = 'triangle' | 'circle' | 'square'

export interface LinkRenderData {
  id: string
  startPoint: Point
  endPoint: Point
  startDirection: Direction
  endDirection: Direction
  color?: string
  type?: string
  controlPoints?: Point[]
  flow?: boolean
  disabled?: boolean
  // Optional multi-segment support
  segments?: Array<{
    start: Point
    end: Point
    controlPoints?: Point[]
  }>
  // Center point storage (for hit detection and menu)
  centerPos?: Point
  centerAngle?: number
}

interface RenderStyle {
  mode: RenderMode
  connectionWidth: number
  borderWidth?: number
  arrowShape?: ArrowShape
  showArrows?: boolean
  lowQuality?: boolean
  // Center marker properties
  showCenterMarker?: boolean
  centerMarkerShape?: 'circle' | 'arrow'
  highQuality?: boolean
}

interface RenderColors {
  default: string
  byType: Record<string, string>
  highlighted: string
}

export interface RenderContext {
  style: RenderStyle
  colors: RenderColors
  patterns?: {
    disabled?: CanvasPattern | null
  }
  animation?: {
    time: number // Seconds for flow animation
  }
  scale?: number // Canvas scale for quality adjustments
  highlightedIds?: Set<string>
}

interface DragLinkData {
  /** Fixed end - the slot being dragged from */
  fixedPoint: Point
  fixedDirection: Direction
  /** Moving end - follows mouse */
  dragPoint: Point
  dragDirection?: Direction
  /** Visual properties */
  color?: string
  type?: string
  disabled?: boolean
  /** Whether dragging from input (reverse direction) */
  fromInput?: boolean
}

const LINEAR_LINK_OFFSET = 15
const STRAIGHT_LINK_OFFSET = 10
const CURVE_SAMPLES = 16

function directionOffset(direction: Direction, distance: number): Point {
  switch (direction) {
    case 'left':
      return { x: -distance, y: 0 }
    case 'right':
      return { x: distance, y: 0 }
    case 'up':
      return { x: 0, y: -distance }
    case 'down':
      return { x: 0, y: distance }
    case 'none':
    default:
      return { x: 0, y: 0 }
  }
}

function offsetPoint(point: Point, direction: Direction, distance: number) {
  const offset = directionOffset(direction, distance)
  return { x: point.x + offset.x, y: point.y + offset.y }
}

function pointOnCubic(
  t: number,
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point
): Point {
  const mt = 1 - t
  const mt2 = mt * mt
  const mt3 = mt2 * mt
  const t2 = t * t
  const t3 = t2 * t
  return {
    x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
    y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y
  }
}

function pointOnCurve(
  start: Point,
  controls: Point[],
  end: Point,
  t: number
): Point {
  if (controls.length >= 2)
    return pointOnCubic(t, start, controls[0], controls[1], end)
  const u = 1 - t
  if (controls.length === 1) {
    const [c1] = controls
    return {
      x: u * u * start.x + 2 * u * t * c1.x + t * t * end.x,
      y: u * u * start.y + 2 * u * t * c1.y + t * t * end.y
    }
  }
  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t
  }
}

function sampleCurve(start: Point, controls: Point[], end: Point): Point[] {
  return Array.from({ length: CURVE_SAMPLES + 1 }, (_, i) =>
    pointOnCurve(start, controls, end, i / CURVE_SAMPLES)
  )
}

export class CanvasPathRenderer {
  /**
   * Draw a link between two points
   * Returns a Path2D object for hit detection
   */
  drawLink(
    ctx: CanvasRenderingContext2D,
    link: LinkRenderData,
    context: RenderContext
  ): Path2D {
    const path = new Path2D()

    const isHighlighted = context.highlightedIds?.has(link.id) ?? false
    const color = this.determineLinkColor(link, context, isHighlighted)

    ctx.save()

    if (link.disabled && context.patterns?.disabled) {
      ctx.strokeStyle = context.patterns.disabled
    } else {
      ctx.strokeStyle = color
    }

    ctx.lineWidth = context.style.connectionWidth
    ctx.lineJoin = 'round'

    if (context.style.borderWidth && !context.style.lowQuality) {
      this.drawLinkPath(
        ctx,
        path,
        link,
        context,
        context.style.connectionWidth + context.style.borderWidth,
        'rgba(0,0,0,0.5)'
      )
    }

    this.drawLinkPath(
      ctx,
      path,
      link,
      context,
      context.style.connectionWidth,
      color
    )

    this.calculateCenterPoint(link, context)

    if (context.style.showArrows) {
      this.drawArrows(ctx, link, context, color)
    }

    if (
      context.style.showCenterMarker &&
      context.scale &&
      context.scale >= 0.6 &&
      context.style.highQuality
    ) {
      this.drawCenterMarker(ctx, link, context, color)
    }

    if (link.flow && context.animation) {
      this.drawFlowAnimation(ctx, path, link, context)
    }

    ctx.restore()

    return path
  }

  private determineLinkColor(
    link: LinkRenderData,
    context: RenderContext,
    isHighlighted: boolean
  ): string {
    if (isHighlighted) {
      return context.colors.highlighted
    }
    if (link.color) {
      return link.color
    }
    if (link.type && context.colors.byType[link.type]) {
      return context.colors.byType[link.type]
    }
    return context.colors.default
  }

  private drawLinkPath(
    ctx: CanvasRenderingContext2D,
    path: Path2D,
    link: LinkRenderData,
    context: RenderContext,
    lineWidth: number,
    color: string
  ): void {
    ctx.strokeStyle = color
    ctx.lineWidth = lineWidth

    const start = link.startPoint
    const end = link.endPoint

    // Build the path based on render mode
    if (context.style.mode === 'linear') {
      this.buildPolylinePath(
        path,
        this.linearPoints(start, end, link.startDirection, link.endDirection)
      )
    } else if (context.style.mode === 'straight') {
      this.buildPolylinePath(
        path,
        this.straightPoints(start, end, link.startDirection, link.endDirection)
      )
    } else {
      this.buildSplinePath(
        path,
        start,
        end,
        link.startDirection,
        link.endDirection,
        link.controlPoints
      )
    }

    ctx.stroke(path)
  }

  private linearPoints(
    start: Point,
    end: Point,
    startDir: Direction,
    endDir: Direction
  ): Point[] {
    const innerA = offsetPoint(start, startDir, LINEAR_LINK_OFFSET)
    const innerB = offsetPoint(end, endDir, LINEAR_LINK_OFFSET)
    return [start, innerA, innerB, end]
  }

  private straightPoints(
    start: Point,
    end: Point,
    startDir: Direction,
    endDir: Direction
  ): Point[] {
    const innerA = offsetPoint(start, startDir, STRAIGHT_LINK_OFFSET)
    const innerB = offsetPoint(end, endDir, STRAIGHT_LINK_OFFSET)
    const midX = (innerA.x + innerB.x) * 0.5
    return [
      start,
      innerA,
      { x: midX, y: innerA.y },
      { x: midX, y: innerB.y },
      innerB,
      end
    ]
  }

  private buildPolylinePath(path: Path2D, points: Point[]): void {
    const [first, ...rest] = points
    path.moveTo(first.x, first.y)
    for (const point of rest) path.lineTo(point.x, point.y)
  }

  polylineOf(link: LinkRenderData, mode: RenderMode): Point[] {
    const { startPoint, endPoint, startDirection, endDirection } = link
    if (mode === 'linear')
      return this.linearPoints(
        startPoint,
        endPoint,
        startDirection,
        endDirection
      )
    if (mode === 'straight')
      return this.straightPoints(
        startPoint,
        endPoint,
        startDirection,
        endDirection
      )
    const controls =
      link.controlPoints ||
      this.calculateControlPoints(
        startPoint,
        endPoint,
        startDirection,
        endDirection
      )
    return sampleCurve(startPoint, controls, endPoint)
  }

  private buildSplinePath(
    path: Path2D,
    start: Point,
    end: Point,
    startDir: Direction,
    endDir: Direction,
    controlPoints?: Point[]
  ): void {
    path.moveTo(start.x, start.y)

    // Calculate control points if not provided
    const controls =
      controlPoints || this.calculateControlPoints(start, end, startDir, endDir)

    if (controls.length >= 2) {
      // Cubic bezier
      path.bezierCurveTo(
        controls[0].x,
        controls[0].y,
        controls[1].x,
        controls[1].y,
        end.x,
        end.y
      )
    } else if (controls.length === 1) {
      // Quadratic bezier
      path.quadraticCurveTo(controls[0].x, controls[0].y, end.x, end.y)
    } else {
      // Fallback to linear
      path.lineTo(end.x, end.y)
    }
  }

  private calculateControlPoints(
    start: Point,
    end: Point,
    startDir: Direction,
    endDir: Direction
  ): Point[] {
    const dist = Math.sqrt(
      Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)
    )
    const controlDist = Math.max(30, dist * 0.25)

    // Calculate control point offsets based on direction
    const startControl = this.getDirectionOffset(startDir, controlDist)
    const endControl = this.getDirectionOffset(endDir, controlDist)

    return [
      { x: start.x + startControl.x, y: start.y + startControl.y },
      { x: end.x + endControl.x, y: end.y + endControl.y }
    ]
  }

  private getDirectionOffset(direction: Direction, distance: number): Point {
    return directionOffset(direction, distance)
  }

  private drawArrows(
    ctx: CanvasRenderingContext2D,
    link: LinkRenderData,
    context: RenderContext,
    color: string
  ): void {
    if (!context.style.showArrows) return

    // Render arrows at 0.25 and 0.75 positions along the path (matching original)
    const positions = [0.25, 0.75]

    for (const t of positions) {
      // Compute arrow position and angle
      const posA = this.computeConnectionPoint(link, t, context)
      const posB = this.computeConnectionPoint(link, t + 0.01, context) // slightly ahead for angle

      const angle = Math.atan2(posB.y - posA.y, posB.x - posA.x)

      // Draw arrow triangle (matching original shape)
      const transform = ctx.getTransform()
      ctx.translate(posA.x, posA.y)
      ctx.rotate(angle)
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.moveTo(-5, -3)
      ctx.lineTo(0, 7)
      ctx.lineTo(5, -3)
      ctx.fill()
      ctx.setTransform(transform)
    }
  }

  /**
   * Compute a point along the link path at position t (0 to 1)
   * For backward compatibility with original litegraph, this always uses
   * bezier calculation with spline offsets, regardless of render mode.
   * This ensures arrow positions match the original implementation.
   */
  private computeConnectionPoint(
    link: LinkRenderData,
    t: number,
    _context: RenderContext
  ): Point {
    const { startPoint, endPoint, startDirection, endDirection } = link

    // Match original behavior: always use bezier math with spline offsets
    // regardless of render mode (for arrow position compatibility)
    const dist = Math.sqrt(
      Math.pow(endPoint.x - startPoint.x, 2) +
        Math.pow(endPoint.y - startPoint.y, 2)
    )
    const factor = 0.25

    // Create control points with spline offsets (matching original #addSplineOffset)
    const pa = { x: startPoint.x, y: startPoint.y }
    const pb = { x: endPoint.x, y: endPoint.y }

    // Apply spline offsets based on direction
    switch (startDirection) {
      case 'left':
        pa.x -= dist * factor
        break
      case 'right':
        pa.x += dist * factor
        break
      case 'up':
        pa.y -= dist * factor
        break
      case 'down':
        pa.y += dist * factor
        break
      case 'none':
        break
    }

    switch (endDirection) {
      case 'left':
        pb.x -= dist * factor
        break
      case 'right':
        pb.x += dist * factor
        break
      case 'up':
        pb.y -= dist * factor
        break
      case 'down':
        pb.y += dist * factor
        break
      case 'none':
        break
    }

    // Calculate bezier point (matching original computeConnectionPoint)
    const c1 = (1 - t) * (1 - t) * (1 - t)
    const c2 = 3 * ((1 - t) * (1 - t)) * t
    const c3 = 3 * (1 - t) * (t * t)
    const c4 = t * t * t

    return {
      x: c1 * startPoint.x + c2 * pa.x + c3 * pb.x + c4 * endPoint.x,
      y: c1 * startPoint.y + c2 * pa.y + c3 * pb.y + c4 * endPoint.y
    }
  }

  private drawFlowAnimation(
    ctx: CanvasRenderingContext2D,
    _path: Path2D,
    link: LinkRenderData,
    context: RenderContext
  ): void {
    if (!context.animation) return

    // Match original implementation: render 5 moving circles along the path
    const time = context.animation.time
    const linkColor = this.determineLinkColor(link, context, false)

    ctx.save()
    ctx.fillStyle = linkColor

    // Draw 5 circles at different positions along the path
    for (let i = 0; i < 5; ++i) {
      // Calculate position along path (0 to 1), with time-based animation
      const f = (time + i * 0.2) % 1
      const flowPos = this.computeConnectionPoint(link, f, context)

      // Draw circle at this position
      ctx.beginPath()
      ctx.arc(flowPos.x, flowPos.y, 5, 0, 2 * Math.PI)
      ctx.fill()
    }

    ctx.restore()
  }

  /**
   * Utility to find a point on a bezier curve (for hit detection)
   */
  findPointOnBezier(
    t: number,
    p0: Point,
    p1: Point,
    p2: Point,
    p3: Point
  ): Point {
    return pointOnCubic(t, p0, p1, p2, p3)
  }

  /**
   * Draw a link being dragged from a slot to the mouse position
   * Returns a Path2D object for potential hit detection
   */
  drawDraggingLink(
    ctx: CanvasRenderingContext2D,
    dragData: DragLinkData,
    context: RenderContext
  ): Path2D {
    // Create LinkRenderData from drag data
    // When dragging from input, swap the points/directions
    const linkData: LinkRenderData = dragData.fromInput
      ? {
          id: 'dragging',
          startPoint: dragData.dragPoint,
          endPoint: dragData.fixedPoint,
          startDirection:
            dragData.dragDirection ||
            this.getOppositeDirection(dragData.fixedDirection),
          endDirection: dragData.fixedDirection,
          color: dragData.color,
          type: dragData.type,
          disabled: dragData.disabled
        }
      : {
          id: 'dragging',
          startPoint: dragData.fixedPoint,
          endPoint: dragData.dragPoint,
          startDirection: dragData.fixedDirection,
          endDirection:
            dragData.dragDirection ||
            this.getOppositeDirection(dragData.fixedDirection),
          color: dragData.color,
          type: dragData.type,
          disabled: dragData.disabled
        }

    // Use standard link drawing
    return this.drawLink(ctx, linkData, context)
  }

  /**
   * Get the opposite direction (for drag preview)
   */
  private getOppositeDirection(direction: Direction): Direction {
    switch (direction) {
      case 'left':
        return 'right'
      case 'right':
        return 'left'
      case 'up':
        return 'down'
      case 'down':
        return 'up'
      case 'none':
      default:
        return 'none'
    }
  }

  /**
   * Get the center point of a link (useful for labels, debugging)
   */
  getLinkCenter(link: LinkRenderData): Point {
    // For now, simple midpoint
    // Could be enhanced to find actual curve midpoint
    return {
      x: (link.startPoint.x + link.endPoint.x) / 2,
      y: (link.startPoint.y + link.endPoint.y) / 2
    }
  }

  private calculateCenterPoint(
    link: LinkRenderData,
    context: RenderContext
  ): void {
    const { startPoint, endPoint, controlPoints } = link
    const wantsAngle = context.style.centerMarkerShape === 'arrow'

    if (
      context.style.mode === 'spline' &&
      controlPoints &&
      controlPoints.length >= 2
    ) {
      const centerPos = this.findPointOnBezier(
        0.5,
        startPoint,
        controlPoints[0],
        controlPoints[1],
        endPoint
      )
      link.centerPos = centerPos

      if (wantsAngle) {
        const justPastCenter = this.findPointOnBezier(
          0.51,
          startPoint,
          controlPoints[0],
          controlPoints[1],
          endPoint
        )
        link.centerAngle = Math.atan2(
          justPastCenter.y - centerPos.y,
          justPastCenter.x - centerPos.x
        )
      }
    } else if (context.style.mode === 'linear') {
      const innerA = offsetPoint(
        startPoint,
        link.startDirection,
        LINEAR_LINK_OFFSET
      )
      const innerB = offsetPoint(
        endPoint,
        link.endDirection,
        LINEAR_LINK_OFFSET
      )
      link.centerPos = {
        x: (innerA.x + innerB.x) * 0.5,
        y: (innerA.y + innerB.y) * 0.5
      }

      if (wantsAngle) {
        link.centerAngle = Math.atan2(innerB.y - innerA.y, innerB.x - innerA.x)
      }
    } else if (context.style.mode === 'straight') {
      const innerA = offsetPoint(
        startPoint,
        link.startDirection,
        STRAIGHT_LINK_OFFSET
      )
      const innerB = offsetPoint(
        endPoint,
        link.endDirection,
        STRAIGHT_LINK_OFFSET
      )
      link.centerPos = {
        x: (innerA.x + innerB.x) * 0.5,
        y: (innerA.y + innerB.y) * 0.5
      }

      if (wantsAngle) {
        const diff = innerB.y - innerA.y
        if (Math.abs(diff) < 4) {
          link.centerAngle = 0
        } else if (diff > 0) {
          link.centerAngle = Math.PI * 0.5
        } else {
          link.centerAngle = -(Math.PI * 0.5)
        }
      }
    } else {
      link.centerPos = this.getLinkCenter(link)
      if (wantsAngle) {
        link.centerAngle = Math.atan2(
          endPoint.y - startPoint.y,
          endPoint.x - startPoint.x
        )
      }
    }
  }

  /**
   * Draw the center marker on a link (for menu interaction)
   * Matches the original litegraph center marker rendering
   */
  private drawCenterMarker(
    ctx: CanvasRenderingContext2D,
    link: LinkRenderData,
    context: RenderContext,
    color: string
  ): void {
    if (!link.centerPos) return

    ctx.beginPath()

    if (
      context.style.centerMarkerShape === 'arrow' &&
      link.centerAngle !== undefined
    ) {
      const transform = ctx.getTransform()
      ctx.translate(link.centerPos.x, link.centerPos.y)
      ctx.rotate(link.centerAngle)
      // The math is off, but it currently looks better in chromium (from original)
      ctx.moveTo(-3.2, -5)
      ctx.lineTo(7, 0)
      ctx.lineTo(-3.2, 5)
      ctx.setTransform(transform)
    } else {
      // Default to circle
      ctx.arc(link.centerPos.x, link.centerPos.y, 5, 0, Math.PI * 2)
    }

    // Apply disabled pattern or color
    if (link.disabled && context.patterns?.disabled) {
      const { fillStyle, globalAlpha } = ctx
      ctx.fillStyle = context.patterns.disabled
      ctx.globalAlpha = 0.75
      ctx.fill()
      ctx.globalAlpha = globalAlpha
      ctx.fillStyle = fillStyle
    } else {
      ctx.fillStyle = color
      ctx.fill()
    }
  }
}
