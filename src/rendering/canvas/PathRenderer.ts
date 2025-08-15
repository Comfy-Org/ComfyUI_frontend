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

export type Direction = 'left' | 'right' | 'up' | 'down'
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

export interface RenderStyle {
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

export interface RenderColors {
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

export interface DragLinkData {
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

    // Determine final color
    const isHighlighted = context.highlightedIds?.has(link.id) ?? false
    const color = this.determineLinkColor(link, context, isHighlighted)

    // Save context state
    ctx.save()

    // Apply disabled pattern if needed
    if (link.disabled && context.patterns?.disabled) {
      ctx.strokeStyle = context.patterns.disabled
    } else {
      ctx.strokeStyle = color
    }

    // Set line properties
    ctx.lineWidth = context.style.connectionWidth
    ctx.lineJoin = 'round'

    // Draw border if needed
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

    // Draw main link
    this.drawLinkPath(
      ctx,
      path,
      link,
      context,
      context.style.connectionWidth,
      color
    )

    // Calculate and store center position
    this.calculateCenterPoint(link, context)

    // Draw arrows if needed
    if (context.style.showArrows) {
      this.drawArrows(ctx, link, context, color)
    }

    // Draw center marker if needed (for link menu interaction)
    if (
      context.style.showCenterMarker &&
      context.scale &&
      context.scale >= 0.6 &&
      context.style.highQuality
    ) {
      this.drawCenterMarker(ctx, link, context, color)
    }

    // Draw flow animation if needed
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
      this.buildLinearPath(path, start, end)
    } else if (context.style.mode === 'straight') {
      this.buildStraightPath(
        path,
        start,
        end,
        link.startDirection,
        link.endDirection
      )
    } else {
      // Spline mode (default)
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

  private buildLinearPath(path: Path2D, start: Point, end: Point): void {
    path.moveTo(start.x, start.y)
    path.lineTo(end.x, end.y)
  }

  private buildStraightPath(
    path: Path2D,
    start: Point,
    end: Point,
    _startDir: Direction,
    _endDir: Direction
  ): void {
    path.moveTo(start.x, start.y)

    const dx = end.x - start.x
    const dy = end.y - start.y

    if (Math.abs(dx) > Math.abs(dy)) {
      const midX = start.x + dx * 0.5
      path.lineTo(midX, start.y)
      path.lineTo(midX, end.y)
    } else {
      const midY = start.y + dy * 0.5
      path.lineTo(start.x, midY)
      path.lineTo(end.x, midY)
    }

    path.lineTo(end.x, end.y)
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
    switch (direction) {
      case 'left':
        return { x: -distance, y: 0 }
      case 'right':
        return { x: distance, y: 0 }
      case 'up':
        return { x: 0, y: -distance }
      case 'down':
        return { x: 0, y: distance }
    }
  }

  private drawArrows(
    ctx: CanvasRenderingContext2D,
    link: LinkRenderData,
    context: RenderContext,
    color: string
  ): void {
    if (!context.style.showArrows) return

    const arrowSize = 5 * (context.scale || 1)
    const shape = context.style.arrowShape || 'triangle'

    // Calculate arrow position (middle of link for now)
    const mid = {
      x: (link.startPoint.x + link.endPoint.x) / 2,
      y: (link.startPoint.y + link.endPoint.y) / 2
    }

    // Calculate angle
    const angle = Math.atan2(
      link.endPoint.y - link.startPoint.y,
      link.endPoint.x - link.startPoint.x
    )

    ctx.save()
    ctx.translate(mid.x, mid.y)
    ctx.rotate(angle)
    ctx.fillStyle = color

    if (shape === 'circle') {
      ctx.beginPath()
      ctx.arc(0, 0, arrowSize, 0, Math.PI * 2)
      ctx.fill()
    } else if (shape === 'square') {
      ctx.fillRect(-arrowSize / 2, -arrowSize / 2, arrowSize, arrowSize)
    } else {
      // Triangle (default)
      ctx.beginPath()
      ctx.moveTo(arrowSize, 0)
      ctx.lineTo(-arrowSize, -arrowSize)
      ctx.lineTo(-arrowSize, arrowSize)
      ctx.closePath()
      ctx.fill()
    }

    ctx.restore()
  }

  private drawFlowAnimation(
    ctx: CanvasRenderingContext2D,
    path: Path2D,
    _link: LinkRenderData,
    context: RenderContext
  ): void {
    if (!context.animation) return

    const time = context.animation.time
    const spacing = 24
    const speed = 48

    ctx.save()
    ctx.strokeStyle = context.colors.highlighted
    ctx.lineWidth = Math.max(1, context.style.connectionWidth * 0.5)

    // Create dashed line effect for flow
    const dashOffset = (time * speed) % spacing
    ctx.setLineDash([4, spacing - 4])
    ctx.lineDashOffset = -dashOffset

    ctx.stroke(path)
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

  /**
   * Calculate and store the center point and angle of a link
   * Mimics the original litegraph center point calculation
   */
  private calculateCenterPoint(
    link: LinkRenderData,
    context: RenderContext
  ): void {
    const { startPoint, endPoint, controlPoints } = link

    if (
      context.style.mode === 'spline' &&
      controlPoints &&
      controlPoints.length >= 2
    ) {
      // For spline mode, find point at t=0.5 on the bezier curve
      const centerPos = this.findPointOnBezier(
        0.5,
        startPoint,
        controlPoints[0],
        controlPoints[1],
        endPoint
      )
      link.centerPos = centerPos

      // Calculate angle for arrow marker (point slightly past center)
      if (context.style.centerMarkerShape === 'arrow') {
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
      // For linear mode, calculate midpoint between control points
      const startControl = this.getDirectionOffset(link.startDirection, 15)
      const endControl = this.getDirectionOffset(link.endDirection, 15)
      const innerA = {
        x: startPoint.x + startControl.x,
        y: startPoint.y + startControl.y
      }
      const innerB = {
        x: endPoint.x + endControl.x,
        y: endPoint.y + endControl.y
      }

      link.centerPos = {
        x: (innerA.x + innerB.x) * 0.5,
        y: (innerA.y + innerB.y) * 0.5
      }

      if (context.style.centerMarkerShape === 'arrow') {
        link.centerAngle = Math.atan2(innerB.y - innerA.y, innerB.x - innerA.x)
      }
    } else if (context.style.mode === 'straight') {
      // For straight mode, calculate midpoint
      const dx = endPoint.x - startPoint.x
      const dy = endPoint.y - startPoint.y

      if (Math.abs(dx) > Math.abs(dy)) {
        const midX = startPoint.x + dx * 0.5
        link.centerPos = {
          x: midX,
          y: (startPoint.y + endPoint.y) * 0.5
        }
      } else {
        const midY = startPoint.y + dy * 0.5
        link.centerPos = {
          x: (startPoint.x + endPoint.x) * 0.5,
          y: midY
        }
      }

      if (context.style.centerMarkerShape === 'arrow') {
        const diff = endPoint.y - startPoint.y
        if (Math.abs(diff) < 4) {
          link.centerAngle = 0
        } else if (diff > 0) {
          link.centerAngle = Math.PI * 0.5
        } else {
          link.centerAngle = -(Math.PI * 0.5)
        }
      }
    } else {
      // Fallback to simple midpoint
      link.centerPos = this.getLinkCenter(link)
      if (context.style.centerMarkerShape === 'arrow') {
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
