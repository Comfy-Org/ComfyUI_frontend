/**
 * Litegraph Link Adapter
 *
 * Bridges the gap between litegraph's data model and the pure canvas renderer.
 * Converts litegraph-specific types (LLink, LGraphNode, slots) into generic
 * rendering data that can be consumed by the PathRenderer.
 * Maintains backward compatibility with existing litegraph integration.
 */
import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { LLink } from '@/lib/litegraph/src/LLink'
import type { Reroute } from '@/lib/litegraph/src/Reroute'
import type {
  CanvasColour,
  INodeInputSlot,
  INodeOutputSlot,
  ReadOnlyPoint
} from '@/lib/litegraph/src/interfaces'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import {
  LinkDirection,
  LinkMarkerShape,
  LinkRenderType
} from '@/lib/litegraph/src/types/globalEnums'
import {
  type ArrowShape,
  CanvasPathRenderer,
  type Direction,
  type DragLinkData,
  type LinkRenderData,
  type RenderContext as PathRenderContext,
  type RenderMode
} from '@/rendering/canvas/PathRenderer'
import type { Point } from '@/types/layoutTypes'

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

export interface LinkRenderOptions {
  color?: CanvasColour
  flow?: boolean
  skipBorder?: boolean
  disabled?: boolean
}

export class LitegraphLinkAdapter {
  private graph: LGraph
  private pathRenderer: CanvasPathRenderer

  constructor(graph: LGraph) {
    this.graph = graph
    this.pathRenderer = new CanvasPathRenderer()
  }

  /**
   * Render a single link with all necessary data properly fetched
   * Populates link.path for hit detection
   */
  renderLink(
    ctx: CanvasRenderingContext2D,
    link: LLink,
    context: LinkRenderContext,
    options: LinkRenderOptions = {}
  ): void {
    // Get nodes from graph
    const sourceNode = this.graph.getNodeById(link.origin_id)
    const targetNode = this.graph.getNodeById(link.target_id)

    if (!sourceNode || !targetNode) {
      console.warn(`Cannot render link ${link.id}: missing nodes`)
      return
    }

    // Get slots from nodes
    const sourceSlot = sourceNode.outputs?.[link.origin_slot]
    const targetSlot = targetNode.inputs?.[link.target_slot]

    if (!sourceSlot || !targetSlot) {
      console.warn(`Cannot render link ${link.id}: missing slots`)
      return
    }

    // Get positions from nodes
    const startPos = sourceNode.getOutputPos(link.origin_slot)
    const endPos = targetNode.getInputPos(link.target_slot)

    // Get directions from slots
    const startDir = sourceSlot.dir || LinkDirection.RIGHT
    const endDir = targetSlot.dir || LinkDirection.LEFT

    // Convert to pure render data
    const linkData = this.convertToLinkRenderData(
      link,
      { x: startPos[0], y: startPos[1] },
      { x: endPos[0], y: endPos[1] },
      startDir,
      endDir,
      options
    )

    // Convert context
    const pathContext = this.convertToPathRenderContext(context)

    // Render using pure renderer
    const path = this.pathRenderer.drawLink(ctx, linkData, pathContext)

    // Store path for hit detection
    link.path = path
  }

  /**
   * Convert litegraph link data to pure render format
   */
  private convertToLinkRenderData(
    link: LLink,
    startPoint: Point,
    endPoint: Point,
    startDir: LinkDirection,
    endDir: LinkDirection,
    options: LinkRenderOptions
  ): LinkRenderData {
    return {
      id: String(link.id),
      startPoint,
      endPoint,
      startDirection: this.convertDirection(startDir),
      endDirection: this.convertDirection(endDir),
      color: options.color
        ? String(options.color)
        : link.color
          ? String(link.color)
          : undefined,
      type: link.type !== undefined ? String(link.type) : undefined,
      flow: options.flow || false,
      disabled: options.disabled || false
    }
  }

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
    return {
      style: {
        mode: this.convertRenderMode(context.renderMode),
        connectionWidth: context.connectionWidth,
        borderWidth: context.renderBorder ? 4 : undefined,
        arrowShape: this.convertArrowShape(context.linkMarkerShape),
        showArrows: context.renderConnectionArrows,
        lowQuality: context.lowQuality,
        // Center marker settings (matches original litegraph behavior)
        showCenterMarker: true,
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
        time: LiteGraph.getTime() * 0.001
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
    point: Point,
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
    a: ReadOnlyPoint,
    b: ReadOnlyPoint,
    link: LLink | null,
    skip_border: boolean,
    flow: number | boolean | null,
    color: CanvasColour | null,
    start_dir: LinkDirection,
    end_dir: LinkDirection,
    context: LinkRenderContext,
    extras: {
      reroute?: Reroute
      startControl?: ReadOnlyPoint
      endControl?: ReadOnlyPoint
      num_sublines?: number
      disabled?: boolean
    } = {}
  ): void {
    // Apply same defaults as original renderLink
    const startDir = start_dir || LinkDirection.RIGHT
    const endDir = end_dir || LinkDirection.LEFT

    // Convert flow to boolean
    const flowBool = flow === true || (typeof flow === 'number' && flow > 0)

    // Create LinkRenderData from direct parameters
    const linkData: LinkRenderData = {
      id: link ? String(link.id) : 'temp',
      startPoint: { x: a[0], y: a[1] },
      endPoint: { x: b[0], y: b[1] },
      startDirection: this.convertDirection(startDir),
      endDirection: this.convertDirection(endDir),
      color: color !== null && color !== undefined ? String(color) : undefined,
      type: link?.type !== undefined ? String(link.type) : undefined,
      flow: flowBool,
      disabled: extras.disabled || false
    }

    // Control points handling (spline mode):
    // - Pre-refactor, the old renderLink honored a single provided control and
    //   derived the missing side via #addSplineOffset (CENTER => no offset).
    // - Restore that behavior here so reroute segments render identically.
    if (context.renderMode === LinkRenderType.SPLINE_LINK) {
      const hasStartCtrl = !!extras.startControl
      const hasEndCtrl = !!extras.endControl

      // Compute distance once for offsets
      const dist = Math.sqrt(
        (b[0] - a[0]) * (b[0] - a[0]) + (b[1] - a[1]) * (b[1] - a[1])
      )
      const factor = 0.25

      const cps: Point[] = []

      if (hasStartCtrl && hasEndCtrl) {
        // Both provided explicitly
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
        // Start provided, derive end via direction offset (CENTER => no offset)
        const start = {
          x: a[0] + (extras.startControl![0] || 0),
          y: a[1] + (extras.startControl![1] || 0)
        }
        const end = { x: b[0], y: b[1] }
        this.applySplineOffset(end, endDir, dist * factor)
        cps.push(start, end)
        linkData.controlPoints = cps
      } else if (!hasStartCtrl && hasEndCtrl) {
        // End provided, derive start via direction offset (CENTER => no offset)
        const start = { x: a[0], y: a[1] }
        this.applySplineOffset(start, startDir, dist * factor)
        const end = {
          x: b[0] + (extras.endControl![0] || 0),
          y: b[1] + (extras.endControl![1] || 0)
        }
        cps.push(start, end)
        linkData.controlPoints = cps
      } else {
        // Neither provided: derive both from directions (CENTER => no offset)
        const start = { x: a[0], y: a[1] }
        const end = { x: b[0], y: b[1] }
        this.applySplineOffset(start, startDir, dist * factor)
        this.applySplineOffset(end, endDir, dist * factor)
        cps.push(start, end)
        linkData.controlPoints = cps
      }
    }

    // Convert context
    const pathContext = this.convertToPathRenderContext(context)

    // Override skip_border if needed
    if (skip_border) {
      pathContext.style.borderWidth = undefined
    }

    // Render using pure renderer
    const path = this.pathRenderer.drawLink(ctx, linkData, pathContext)

    // Store path for hit detection
    const linkSegment = extras.reroute ?? link
    if (linkSegment) {
      linkSegment.path = path

      // Copy calculated center position back to litegraph object
      // This is needed for hit detection and menu interaction
      if (linkData.centerPos) {
        linkSegment._pos = linkSegment._pos || new Float32Array(2)
        linkSegment._pos[0] = linkData.centerPos.x
        linkSegment._pos[1] = linkData.centerPos.y

        // Store center angle if calculated (for arrow markers)
        if (linkData.centerAngle !== undefined) {
          linkSegment._centreAngle = linkData.centerAngle
        }
      }
    }
  }

  /**
   * Render a link being dragged from a slot to mouse position
   * Used during link creation/reconnection
   */
  renderDraggingLink(
    ctx: CanvasRenderingContext2D,
    fromNode: LGraphNode | null,
    fromSlot: INodeOutputSlot | INodeInputSlot,
    fromSlotIndex: number,
    toPosition: ReadOnlyPoint,
    context: LinkRenderContext,
    options: {
      fromInput?: boolean
      color?: CanvasColour
      disabled?: boolean
    } = {}
  ): void {
    if (!fromNode) return

    // Get slot position
    const slotPos = options.fromInput
      ? fromNode.getInputPos(fromSlotIndex)
      : fromNode.getOutputPos(fromSlotIndex)
    if (!slotPos) return

    // Get slot direction
    const slotDir =
      fromSlot.dir ||
      (options.fromInput ? LinkDirection.LEFT : LinkDirection.RIGHT)

    // Create drag data
    const dragData: DragLinkData = {
      fixedPoint: { x: slotPos[0], y: slotPos[1] },
      fixedDirection: this.convertDirection(slotDir),
      dragPoint: { x: toPosition[0], y: toPosition[1] },
      color: options.color ? String(options.color) : undefined,
      type: fromSlot.type !== undefined ? String(fromSlot.type) : undefined,
      disabled: options.disabled || false,
      fromInput: options.fromInput || false
    }

    // Convert context
    const pathContext = this.convertToPathRenderContext(context)

    // Render using pure renderer
    this.pathRenderer.drawDraggingLink(ctx, dragData, pathContext)
  }
}
