import type { LLink, Reroute } from '@/lib/litegraph/src/types/entityRegistry'
/**
 * Litegraph Link Adapter
 *
 * Bridges the gap between litegraph's data model and the pure canvas renderer.
 * Converts litegraph-specific types (LLink, LGraphNode, slots) into generic
 * rendering data that can be consumed by the PathRenderer.
 * Maintains backward compatibility with existing litegraph integration.
 */

import type { CanvasColour, Point } from '@/lib/litegraph/src/interfaces'
import { litegraph } from '@/lib/litegraph/src/litegraphInstance'
import {
  LinkDirection,
  LinkMarkerShape,
  LinkRenderType
} from '@/lib/litegraph/src/types/globalEnums'
import { CanvasPathRenderer } from '@/renderer/core/canvas/pathRenderer'
import type {
  ArrowShape,
  Direction,
  LinkRenderData,
  RenderContext as PathRenderContext,
  Point as PointObj,
  RenderMode
} from '@/renderer/core/canvas/pathRenderer'
import { setLinkPolyline } from '@/renderer/core/canvas/linkPolylines'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import type { Bounds } from '@/renderer/core/layout/types'

export interface LinkRenderContext {
  // Canvas settings
  renderMode: LinkRenderType
  connectionWidth: number
  renderBorder: boolean
  lowQuality: boolean
  highQualityRender: boolean
  scale: number
  linkMarkerShape: LinkMarkerShape
  renderConnectionArrows: boolean

  // State
  highlightedLinks: Set<string | number>

  // Colors
  defaultLinkColor: CanvasColour
  linkTypeColors: Record<string, CanvasColour>

  // Pattern for disabled links (optional)
  disabledPattern?: CanvasPattern | null
}

export class LitegraphLinkAdapter {
  private readonly pathRenderer = new CanvasPathRenderer()

  constructor(public readonly enableLayoutStoreWrites = true) {}

  /**
   * Convert LinkDirection enum to Direction string
   */
  private convertDirection(dir: LinkDirection): Direction {
    switch (dir) {
      case LinkDirection.LEFT:
        return 'left'
      case LinkDirection.RIGHT:
        return 'right'
      case LinkDirection.UP:
        return 'up'
      case LinkDirection.DOWN:
        return 'down'
      case LinkDirection.CENTER:
      case LinkDirection.NONE:
        return 'none'
      default:
        return 'right'
    }
  }

  /**
   * Convert LinkRenderContext to PathRenderContext
   */
  private convertToPathRenderContext(
    context: LinkRenderContext
  ): PathRenderContext {
    // Match original arrow rendering conditions:
    // Arrows only render when scale >= 0.6 AND highquality_render AND render_connection_arrows
    const shouldShowArrows =
      context.scale >= 0.6 &&
      context.highQualityRender &&
      context.renderConnectionArrows

    // Only show center marker when not set to None
    const shouldShowCenterMarker =
      context.linkMarkerShape !== LinkMarkerShape.None

    return {
      style: {
        mode: this.convertRenderMode(context.renderMode),
        connectionWidth: context.connectionWidth,
        borderWidth: context.renderBorder ? 4 : undefined,
        arrowShape: this.convertArrowShape(context.linkMarkerShape),
        showArrows: shouldShowArrows,
        lowQuality: context.lowQuality,
        // Center marker settings (matches original litegraph behavior)
        showCenterMarker: shouldShowCenterMarker,
        centerMarkerShape:
          context.linkMarkerShape === LinkMarkerShape.Arrow
            ? 'arrow'
            : 'circle',
        highQuality: context.highQualityRender
      },
      colors: {
        default: String(context.defaultLinkColor),
        byType: this.convertColorMap(context.linkTypeColors),
        highlighted: '#FFF'
      },
      patterns: {
        disabled: context.disabledPattern
      },
      animation: {
        time: litegraph().getTime() * 0.001
      },
      scale: context.scale,
      highlightedIds: new Set(Array.from(context.highlightedLinks).map(String))
    }
  }

  /**
   * Convert LinkRenderType to RenderMode
   */
  private convertRenderMode(mode: LinkRenderType): RenderMode {
    switch (mode) {
      case LinkRenderType.LINEAR_LINK:
        return 'linear'
      case LinkRenderType.STRAIGHT_LINK:
        return 'straight'
      case LinkRenderType.SPLINE_LINK:
      default:
        return 'spline'
    }
  }

  /**
   * Convert LinkMarkerShape to ArrowShape
   */
  private convertArrowShape(shape: LinkMarkerShape): ArrowShape {
    switch (shape) {
      case LinkMarkerShape.Circle:
        return 'circle'
      case LinkMarkerShape.Arrow:
      default:
        return 'triangle'
    }
  }

  /**
   * Convert color map to ensure all values are strings
   */
  private convertColorMap(
    colors: Record<string, CanvasColour>
  ): Record<string, string> {
    const result: Record<string, string> = {}
    for (const [key, value] of Object.entries(colors)) {
      result[key] = String(value)
    }
    return result
  }

  /**
   * Apply spline offset to a point, mimicking original #addSplineOffset behavior
   * Critically: does nothing for CENTER/NONE directions (no case for them)
   */
  private applySplineOffset(
    point: PointObj,
    direction: LinkDirection,
    distance: number
  ): void {
    switch (direction) {
      case LinkDirection.LEFT:
        point.x -= distance
        break
      case LinkDirection.RIGHT:
        point.x += distance
        break
      case LinkDirection.UP:
        point.y -= distance
        break
      case LinkDirection.DOWN:
        point.y += distance
        break
      // CENTER and NONE: no offset applied (original behavior)
    }
  }

  /**
   * Direct rendering method compatible with LGraphCanvas
   * Converts data and delegates to pure renderer
   */
  renderLinkDirect(
    ctx: CanvasRenderingContext2D,
    a: Readonly<Point>,
    b: Readonly<Point>,
    link: LLink | null,
    skip_border: boolean,
    flow: number | boolean | null,
    color: CanvasColour | null,
    start_dir: LinkDirection,
    end_dir: LinkDirection,
    context: LinkRenderContext,
    extras: {
      reroute?: Reroute
      startControl?: Readonly<Point>
      endControl?: Readonly<Point>
      num_sublines?: number
      disabled?: boolean
    } = {}
  ): void {
    const startDir = start_dir || LinkDirection.RIGHT
    const endDir = end_dir || LinkDirection.LEFT

    const flowBool = flow === true || (typeof flow === 'number' && flow > 0)

    const linkData: LinkRenderData = {
      id: link ? String(link.id) : 'temp',
      startPoint: { x: a[0], y: a[1] },
      endPoint: { x: b[0], y: b[1] },
      startDirection: this.convertDirection(startDir),
      endDirection: this.convertDirection(endDir),
      color: color !== null ? String(color) : undefined,
      type: link?.type !== undefined ? String(link.type) : undefined,
      flow: flowBool,
      disabled: extras.disabled || false
    }

    if (context.renderMode === LinkRenderType.SPLINE_LINK) {
      const hasStartCtrl = !!extras.startControl
      const hasEndCtrl = !!extras.endControl

      const dist = Math.sqrt(
        (b[0] - a[0]) * (b[0] - a[0]) + (b[1] - a[1]) * (b[1] - a[1])
      )
      const factor = 0.25

      const cps: PointObj[] = []

      if (hasStartCtrl && hasEndCtrl) {
        cps.push(
          {
            x: a[0] + (extras.startControl![0] || 0),
            y: a[1] + (extras.startControl![1] || 0)
          },
          {
            x: b[0] + (extras.endControl![0] || 0),
            y: b[1] + (extras.endControl![1] || 0)
          }
        )
        linkData.controlPoints = cps
      } else if (hasStartCtrl && !hasEndCtrl) {
        const start = {
          x: a[0] + (extras.startControl![0] || 0),
          y: a[1] + (extras.startControl![1] || 0)
        }
        const end = { x: b[0], y: b[1] }
        this.applySplineOffset(end, endDir, dist * factor)
        cps.push(start, end)
        linkData.controlPoints = cps
      } else if (!hasStartCtrl && hasEndCtrl) {
        const start = { x: a[0], y: a[1] }
        this.applySplineOffset(start, startDir, dist * factor)
        const end = {
          x: b[0] + (extras.endControl![0] || 0),
          y: b[1] + (extras.endControl![1] || 0)
        }
        cps.push(start, end)
        linkData.controlPoints = cps
      } else {
        const start = { x: a[0], y: a[1] }
        const end = { x: b[0], y: b[1] }
        this.applySplineOffset(start, startDir, dist * factor)
        this.applySplineOffset(end, endDir, dist * factor)
        cps.push(start, end)
        linkData.controlPoints = cps
      }
    }

    const pathContext = this.convertToPathRenderContext(context)

    if (skip_border) {
      pathContext.style.borderWidth = undefined
    }

    const path = this.pathRenderer.drawLink(ctx, linkData, pathContext)

    const linkSegment = extras.reroute ?? link
    if (linkSegment) {
      linkSegment.path = path
      setLinkPolyline(linkSegment, () =>
        this.pathRenderer.polylineOf(linkData, pathContext.style.mode)
      )

      if (linkData.centerPos) {
        linkSegment._pos[0] = linkData.centerPos.x
        linkSegment._pos[1] = linkData.centerPos.y

        if (linkData.centerAngle !== undefined) {
          linkSegment._centreAngle = linkData.centerAngle
        }
      }

      if (this.enableLayoutStoreWrites && link && link.id !== -1) {
        const bounds = this.calculateLinkBounds(
          [linkData.startPoint.x, linkData.startPoint.y] as Readonly<Point>,
          [linkData.endPoint.x, linkData.endPoint.y] as Readonly<Point>,
          linkData
        )
        const centerPos = linkData.centerPos || {
          x: (linkData.startPoint.x + linkData.endPoint.x) / 2,
          y: (linkData.startPoint.y + linkData.endPoint.y) / 2
        }

        if (!extras.reroute) {
          layoutStore.updateLinkLayout(link.id, {
            id: link.id,
            path: path,
            bounds: bounds,
            centerPos: centerPos,
            sourceNodeId: link.origin_id,
            targetNodeId: link.target_id,
            sourceSlot: link.origin_slot,
            targetSlot: link.target_slot
          })
        }

        const rerouteId = extras.reroute ? extras.reroute.id : null
        layoutStore.updateLinkSegmentLayout(link.id, rerouteId, {
          path: path,
          bounds: bounds,
          centerPos: centerPos
        })
      }
    }
  }

  renderDraggingLink(
    ctx: CanvasRenderingContext2D,
    from: Readonly<Point>,
    to: Readonly<Point>,
    colour: CanvasColour,
    startDir: LinkDirection,
    endDir: LinkDirection,
    context: LinkRenderContext
  ): void {
    this.renderLinkDirect(
      ctx,
      from,
      to,
      null,
      false,
      null,
      colour,
      startDir,
      endDir,
      {
        ...context,
        linkMarkerShape: LinkMarkerShape.None
      },
      {
        disabled: false
      }
    )
  }

  /**
   * Calculate bounding box for a link
   * Includes padding for line width and control points
   */
  private calculateLinkBounds(
    startPos: Readonly<Point>,
    endPos: Readonly<Point>,
    linkData: LinkRenderData
  ): Bounds {
    let minX = Math.min(startPos[0], endPos[0])
    let maxX = Math.max(startPos[0], endPos[0])
    let minY = Math.min(startPos[1], endPos[1])
    let maxY = Math.max(startPos[1], endPos[1])

    // Include control points if they exist (for spline links)
    if (linkData.controlPoints) {
      for (const cp of linkData.controlPoints) {
        minX = Math.min(minX, cp.x)
        maxX = Math.max(maxX, cp.x)
        minY = Math.min(minY, cp.y)
        maxY = Math.max(maxY, cp.y)
      }
    }

    // Add padding for line width and hit tolerance
    const padding = 20

    return {
      x: minX - padding,
      y: minY - padding,
      width: maxX - minX + 2 * padding,
      height: maxY - minY + 2 * padding
    }
  }
}
