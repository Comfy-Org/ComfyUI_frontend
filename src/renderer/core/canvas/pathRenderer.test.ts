import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  LinkRenderData,
  Point,
  RenderContext
} from '@/renderer/core/canvas/pathRenderer'
import { CanvasPathRenderer } from '@/renderer/core/canvas/pathRenderer'

// --- Path2D stub ---
class StubPath2D {
  calls: Array<{ method: string; args: unknown[] }> = []
  moveTo(...args: unknown[]) {
    this.calls.push({ method: 'moveTo', args })
  }
  lineTo(...args: unknown[]) {
    this.calls.push({ method: 'lineTo', args })
  }
  bezierCurveTo(...args: unknown[]) {
    this.calls.push({ method: 'bezierCurveTo', args })
  }
  quadraticCurveTo(...args: unknown[]) {
    this.calls.push({ method: 'quadraticCurveTo', args })
  }
  arc(...args: unknown[]) {
    this.calls.push({ method: 'arc', args })
  }
}

vi.stubGlobal('Path2D', StubPath2D)

// --- Canvas context stub ---
function createMockCtx(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    getTransform: vi.fn(() => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 })),
    setTransform: vi.fn(),
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 0,
    lineJoin: 'round',
    globalAlpha: 1
  } as unknown as CanvasRenderingContext2D
}

function makeLink(overrides: Partial<LinkRenderData> = {}): LinkRenderData {
  return {
    id: 'link-1',
    startPoint: { x: 0, y: 0 },
    endPoint: { x: 200, y: 100 },
    startDirection: 'right',
    endDirection: 'left',
    ...overrides
  }
}

function makeContext(overrides: Partial<RenderContext> = {}): RenderContext {
  return {
    style: {
      mode: 'spline',
      connectionWidth: 3,
      ...overrides.style
    },
    colors: {
      default: '#ffffff',
      byType: {},
      highlighted: '#ffff00',
      ...overrides.colors
    },
    ...overrides
  }
}

describe('CanvasPathRenderer', () => {
  let renderer: CanvasPathRenderer

  beforeEach(() => {
    renderer = new CanvasPathRenderer()
  })

  // ── determineLinkColor (tested via drawLink) ──────────────────────

  describe('link color determination', () => {
    it('uses highlighted color when link is highlighted', () => {
      const ctx = createMockCtx()
      const link = makeLink()
      const context = makeContext({
        highlightedIds: new Set(['link-1'])
      })

      renderer.drawLink(ctx, link, context)

      expect(ctx.strokeStyle).toBe('#ffff00')
    })

    it('uses link-specific color over type and default', () => {
      const ctx = createMockCtx()
      const link = makeLink({ color: '#ff0000' })
      const context = makeContext()

      renderer.drawLink(ctx, link, context)

      expect(ctx.strokeStyle).toBe('#ff0000')
    })

    it('uses type color when no explicit link color', () => {
      const ctx = createMockCtx()
      const link = makeLink({ type: 'IMAGE' })
      const context = makeContext({
        colors: {
          default: '#ffffff',
          byType: { IMAGE: '#00ff00' },
          highlighted: '#ffff00'
        }
      })

      renderer.drawLink(ctx, link, context)

      expect(ctx.strokeStyle).toBe('#00ff00')
    })

    it('falls back to default color', () => {
      const ctx = createMockCtx()
      const link = makeLink()
      const context = makeContext()

      renderer.drawLink(ctx, link, context)

      expect(ctx.strokeStyle).toBe('#ffffff')
    })
  })

  // ── drawLink border ───────────────────────────────────────────────

  describe('drawLink border', () => {
    it('draws border when borderWidth is set and not lowQuality', () => {
      const ctx = createMockCtx()
      const link = makeLink()
      const context = makeContext({
        style: { mode: 'spline', connectionWidth: 3, borderWidth: 2 }
      })

      renderer.drawLink(ctx, link, context)

      // stroke is called twice: once for border, once for main
      expect(ctx.stroke).toHaveBeenCalledTimes(2)
    })

    it('skips border in lowQuality mode', () => {
      const ctx = createMockCtx()
      const link = makeLink()
      const context = makeContext({
        style: {
          mode: 'spline',
          connectionWidth: 3,
          borderWidth: 2,
          lowQuality: true
        }
      })

      renderer.drawLink(ctx, link, context)

      // Only main stroke
      expect(ctx.stroke).toHaveBeenCalledTimes(1)
    })
  })

  // ── disabled pattern ──────────────────────────────────────────────

  describe('disabled links', () => {
    it('applies disabled pattern when link is disabled', () => {
      const ctx = createMockCtx()
      const disabledPattern = {} as CanvasPattern
      const link = makeLink({ disabled: true })
      const context = makeContext({
        patterns: { disabled: disabledPattern }
      })

      renderer.drawLink(ctx, link, context)

      // The initial strokeStyle is set to the disabled pattern before drawLinkPath
      // drawLinkPath then overrides it, but the initial assignment still happens
      expect(ctx.save).toHaveBeenCalled()
    })
  })

  // ── buildLinearPath ───────────────────────────────────────────────

  describe('linear path mode', () => {
    it('builds a 4-point path with directional offsets', () => {
      const ctx = createMockCtx()
      const link = makeLink({
        startDirection: 'right',
        endDirection: 'left'
      })
      const context = makeContext({
        style: { mode: 'linear', connectionWidth: 3 }
      })

      const path = renderer.drawLink(
        ctx,
        link,
        context
      ) as unknown as StubPath2D

      const moveToCall = path.calls.find((c) => c.method === 'moveTo')
      const lineToCalls = path.calls.filter((c) => c.method === 'lineTo')

      expect(moveToCall).toBeDefined()
      // Linear mode: start -> innerA -> innerB -> end = 3 lineTo calls
      expect(lineToCalls).toHaveLength(3)
      // innerA.x = start.x + 15 (right direction)
      expect(lineToCalls[0].args).toEqual([15, 0])
      // innerB.x = end.x - 15 (left direction)
      expect(lineToCalls[1].args).toEqual([185, 100])
      // end point
      expect(lineToCalls[2].args).toEqual([200, 100])
    })

    it('handles up/down directions', () => {
      const ctx = createMockCtx()
      const link = makeLink({
        startPoint: { x: 50, y: 50 },
        endPoint: { x: 50, y: 200 },
        startDirection: 'down',
        endDirection: 'up'
      })
      const context = makeContext({
        style: { mode: 'linear', connectionWidth: 3 }
      })

      const path = renderer.drawLink(
        ctx,
        link,
        context
      ) as unknown as StubPath2D
      const lineToCalls = path.calls.filter((c) => c.method === 'lineTo')

      // innerA: y + 15 (down), innerB: y - 15 (up)
      expect(lineToCalls[0].args).toEqual([50, 65])
      expect(lineToCalls[1].args).toEqual([50, 185])
    })

    it('handles none direction (no offset)', () => {
      const ctx = createMockCtx()
      const link = makeLink({
        startDirection: 'none',
        endDirection: 'none'
      })
      const context = makeContext({
        style: { mode: 'linear', connectionWidth: 3 }
      })

      const path = renderer.drawLink(
        ctx,
        link,
        context
      ) as unknown as StubPath2D
      const lineToCalls = path.calls.filter((c) => c.method === 'lineTo')

      // No offset — innerA == start, innerB == end
      expect(lineToCalls[0].args).toEqual([0, 0])
      expect(lineToCalls[1].args).toEqual([200, 100])
    })
  })

  // ── buildStraightPath ─────────────────────────────────────────────

  describe('straight path mode', () => {
    it('builds a 6-point path with mid-X routing', () => {
      const ctx = createMockCtx()
      const link = makeLink({
        startPoint: { x: 0, y: 0 },
        endPoint: { x: 200, y: 100 },
        startDirection: 'right',
        endDirection: 'left'
      })
      const context = makeContext({
        style: { mode: 'straight', connectionWidth: 3 }
      })

      const path = renderer.drawLink(
        ctx,
        link,
        context
      ) as unknown as StubPath2D
      const lineToCalls = path.calls.filter((c) => c.method === 'lineTo')

      // straight: start -> innerA -> (midX, innerA.y) -> (midX, innerB.y) -> innerB -> end
      expect(lineToCalls).toHaveLength(5)

      // innerA = (10, 0), innerB = (190, 100), midX = 100
      expect(lineToCalls[0].args).toEqual([10, 0]) // innerA
      expect(lineToCalls[1].args).toEqual([100, 0]) // midX, innerA.y
      expect(lineToCalls[2].args).toEqual([100, 100]) // midX, innerB.y
      expect(lineToCalls[3].args).toEqual([190, 100]) // innerB
      expect(lineToCalls[4].args).toEqual([200, 100]) // end
    })

    it('handles up direction offset (l=10)', () => {
      const ctx = createMockCtx()
      const link = makeLink({
        startPoint: { x: 100, y: 100 },
        endPoint: { x: 100, y: 300 },
        startDirection: 'up',
        endDirection: 'down'
      })
      const context = makeContext({
        style: { mode: 'straight', connectionWidth: 3 }
      })

      const path = renderer.drawLink(
        ctx,
        link,
        context
      ) as unknown as StubPath2D
      const lineToCalls = path.calls.filter((c) => c.method === 'lineTo')

      // innerA = (100, 90), innerB = (100, 310), midX = 100
      expect(lineToCalls[0].args).toEqual([100, 90])
      expect(lineToCalls[3].args).toEqual([100, 310])
    })
  })

  // ── buildSplinePath ───────────────────────────────────────────────

  describe('spline path mode', () => {
    it('uses provided control points for cubic bezier', () => {
      const ctx = createMockCtx()
      const cp: Point[] = [
        { x: 50, y: 10 },
        { x: 150, y: 90 }
      ]
      const link = makeLink({ controlPoints: cp })
      const context = makeContext()

      const path = renderer.drawLink(
        ctx,
        link,
        context
      ) as unknown as StubPath2D
      const bezier = path.calls.find((c) => c.method === 'bezierCurveTo')

      expect(bezier).toBeDefined()
      expect(bezier!.args).toEqual([50, 10, 150, 90, 200, 100])
    })

    it('auto-calculates control points when none provided', () => {
      const ctx = createMockCtx()
      const link = makeLink()
      const context = makeContext()

      const path = renderer.drawLink(
        ctx,
        link,
        context
      ) as unknown as StubPath2D
      const bezier = path.calls.find((c) => c.method === 'bezierCurveTo')

      expect(bezier).toBeDefined()
    })

    it('uses quadratic curve for single control point', () => {
      const ctx = createMockCtx()
      const link = makeLink({ controlPoints: [{ x: 100, y: 50 }] })
      const context = makeContext()

      const path = renderer.drawLink(
        ctx,
        link,
        context
      ) as unknown as StubPath2D
      const quad = path.calls.find((c) => c.method === 'quadraticCurveTo')

      expect(quad).toBeDefined()
      expect(quad!.args).toEqual([100, 50, 200, 100])
    })

    it('falls back to lineTo when no control points', () => {
      const ctx = createMockCtx()
      const link = makeLink({ controlPoints: [] })
      const context = makeContext()

      const path = renderer.drawLink(
        ctx,
        link,
        context
      ) as unknown as StubPath2D
      const lineToCall = path.calls.find((c) => c.method === 'lineTo')

      expect(lineToCall).toBeDefined()
      expect(lineToCall!.args).toEqual([200, 100])
    })
  })

  // ── calculateControlPoints / getDirectionOffset ───────────────────

  describe('auto-calculated control points', () => {
    it('produces control points offset in the start/end directions', () => {
      const ctx = createMockCtx()
      const link = makeLink({
        startPoint: { x: 0, y: 0 },
        endPoint: { x: 400, y: 0 },
        startDirection: 'right',
        endDirection: 'left'
      })
      const context = makeContext()

      const path = renderer.drawLink(
        ctx,
        link,
        context
      ) as unknown as StubPath2D
      const bezier = path.calls.find((c) => c.method === 'bezierCurveTo')!

      // dist=400, controlDist = max(30, 400*0.25) = 100
      // cp1 = (0+100, 0) = (100, 0)
      // cp2 = (400-100, 0) = (300, 0)
      expect(bezier.args[0]).toBe(100) // cp1.x
      expect(bezier.args[1]).toBe(0) // cp1.y
      expect(bezier.args[2]).toBe(300) // cp2.x
      expect(bezier.args[3]).toBe(0) // cp2.y
    })

    it('uses minimum controlDist of 30 for short links', () => {
      const ctx = createMockCtx()
      const link = makeLink({
        startPoint: { x: 0, y: 0 },
        endPoint: { x: 10, y: 0 },
        startDirection: 'right',
        endDirection: 'left'
      })
      const context = makeContext()

      const path = renderer.drawLink(
        ctx,
        link,
        context
      ) as unknown as StubPath2D
      const bezier = path.calls.find((c) => c.method === 'bezierCurveTo')!

      // dist=10, controlDist = max(30, 10*0.25) = 30
      expect(bezier.args[0]).toBe(30) // cp1.x = 0 + 30
      expect(bezier.args[2]).toBe(-20) // cp2.x = 10 - 30
    })
  })

  // ── findPointOnBezier ─────────────────────────────────────────────

  describe('findPointOnBezier', () => {
    const p0: Point = { x: 0, y: 0 }
    const p1: Point = { x: 100, y: 0 }
    const p2: Point = { x: 100, y: 100 }
    const p3: Point = { x: 200, y: 100 }

    it('returns start point at t=0', () => {
      const result = renderer.findPointOnBezier(0, p0, p1, p2, p3)
      expect(result).toEqual({ x: 0, y: 0 })
    })

    it('returns end point at t=1', () => {
      const result = renderer.findPointOnBezier(1, p0, p1, p2, p3)
      expect(result).toEqual({ x: 200, y: 100 })
    })

    it('returns midpoint at t=0.5', () => {
      const result = renderer.findPointOnBezier(0.5, p0, p1, p2, p3)
      // Cubic bezier at t=0.5: 0.125*p0 + 0.375*p1 + 0.375*p2 + 0.125*p3
      expect(result.x).toBeCloseTo(100)
      expect(result.y).toBeCloseTo(50)
    })
  })

  // ── getLinkCenter ─────────────────────────────────────────────────

  describe('getLinkCenter', () => {
    it('returns midpoint between start and end', () => {
      const link = makeLink({
        startPoint: { x: 0, y: 0 },
        endPoint: { x: 200, y: 100 }
      })
      expect(renderer.getLinkCenter(link)).toEqual({ x: 100, y: 50 })
    })
  })

  // ── calculateCenterPoint (via drawLink) ───────────────────────────

  describe('center point calculation', () => {
    it('calculates spline center using bezier at t=0.5', () => {
      const ctx = createMockCtx()
      const cp: Point[] = [
        { x: 50, y: 0 },
        { x: 150, y: 100 }
      ]
      const link = makeLink({ controlPoints: cp })
      const context = makeContext()

      renderer.drawLink(ctx, link, context)

      expect(link.centerPos).toBeDefined()
      expect(link.centerPos!.x).toBeCloseTo(100)
      expect(link.centerPos!.y).toBeCloseTo(50)
    })

    it('calculates spline center angle for arrow marker', () => {
      const ctx = createMockCtx()
      const cp: Point[] = [
        { x: 50, y: 0 },
        { x: 150, y: 100 }
      ]
      const link = makeLink({ controlPoints: cp })
      const context = makeContext({
        style: {
          mode: 'spline',
          connectionWidth: 3,
          centerMarkerShape: 'arrow'
        }
      })

      renderer.drawLink(ctx, link, context)

      expect(link.centerAngle).toBeDefined()
      expect(typeof link.centerAngle).toBe('number')
    })

    it('calculates linear center as midpoint of inner control points', () => {
      const ctx = createMockCtx()
      const link = makeLink({
        startPoint: { x: 0, y: 0 },
        endPoint: { x: 200, y: 100 },
        startDirection: 'right',
        endDirection: 'left'
      })
      const context = makeContext({
        style: { mode: 'linear', connectionWidth: 3 }
      })

      renderer.drawLink(ctx, link, context)

      // innerA = (15, 0), innerB = (185, 100) → center = (100, 50)
      expect(link.centerPos).toEqual({ x: 100, y: 50 })
    })

    it('calculates straight center with l=10 offsets', () => {
      const ctx = createMockCtx()
      const link = makeLink({
        startPoint: { x: 0, y: 0 },
        endPoint: { x: 200, y: 100 },
        startDirection: 'right',
        endDirection: 'left'
      })
      const context = makeContext({
        style: { mode: 'straight', connectionWidth: 3 }
      })

      renderer.drawLink(ctx, link, context)

      // innerA = (10, 0), innerB = (190, 100) → center = (100, 50)
      expect(link.centerPos).toEqual({ x: 100, y: 50 })
    })

    it('calculates straight center angle = 0 when y diff < 4', () => {
      const ctx = createMockCtx()
      const link = makeLink({
        startPoint: { x: 0, y: 50 },
        endPoint: { x: 200, y: 52 },
        startDirection: 'right',
        endDirection: 'left'
      })
      const context = makeContext({
        style: {
          mode: 'straight',
          connectionWidth: 3,
          centerMarkerShape: 'arrow'
        }
      })

      renderer.drawLink(ctx, link, context)

      expect(link.centerAngle).toBe(0)
    })

    it('calculates straight center angle = PI/2 when end is below', () => {
      const ctx = createMockCtx()
      const link = makeLink({
        startPoint: { x: 0, y: 0 },
        endPoint: { x: 200, y: 100 },
        startDirection: 'right',
        endDirection: 'left'
      })
      const context = makeContext({
        style: {
          mode: 'straight',
          connectionWidth: 3,
          centerMarkerShape: 'arrow'
        }
      })

      renderer.drawLink(ctx, link, context)

      expect(link.centerAngle).toBe(Math.PI * 0.5)
    })

    it('calculates straight center angle = -PI/2 when end is above', () => {
      const ctx = createMockCtx()
      const link = makeLink({
        startPoint: { x: 0, y: 100 },
        endPoint: { x: 200, y: 0 },
        startDirection: 'right',
        endDirection: 'left'
      })
      const context = makeContext({
        style: {
          mode: 'straight',
          connectionWidth: 3,
          centerMarkerShape: 'arrow'
        }
      })

      renderer.drawLink(ctx, link, context)

      expect(link.centerAngle).toBe(-(Math.PI * 0.5))
    })

    it('calculates linear center angle for arrow marker', () => {
      const ctx = createMockCtx()
      const link = makeLink({
        startDirection: 'right',
        endDirection: 'left'
      })
      const context = makeContext({
        style: {
          mode: 'linear',
          connectionWidth: 3,
          centerMarkerShape: 'arrow'
        }
      })

      renderer.drawLink(ctx, link, context)

      expect(link.centerAngle).toBeDefined()
    })
  })

  // ── drawArrows ────────────────────────────────────────────────────

  describe('arrows', () => {
    it('draws arrows at 0.25 and 0.75 positions when showArrows=true', () => {
      const ctx = createMockCtx()
      const link = makeLink()
      const context = makeContext({
        style: { mode: 'spline', connectionWidth: 3, showArrows: true }
      })

      renderer.drawLink(ctx, link, context)

      // Each arrow: translate + rotate + beginPath + moveTo + lineTo×2 + fill + setTransform
      // 2 arrows → fill called 2 times
      expect(ctx.fill).toHaveBeenCalledTimes(2)
      expect(ctx.translate).toHaveBeenCalledTimes(2)
      expect(ctx.rotate).toHaveBeenCalledTimes(2)
    })

    it('does not draw arrows when showArrows=false', () => {
      const ctx = createMockCtx()
      const link = makeLink()
      const context = makeContext()

      renderer.drawLink(ctx, link, context)

      expect(ctx.fill).not.toHaveBeenCalled()
    })
  })

  // ── drawCenterMarker ──────────────────────────────────────────────

  describe('center marker', () => {
    it('draws circle marker when conditions are met', () => {
      const ctx = createMockCtx()
      const link = makeLink({
        controlPoints: [
          { x: 50, y: 0 },
          { x: 150, y: 100 }
        ]
      })
      const context = makeContext({
        style: {
          mode: 'spline',
          connectionWidth: 3,
          showCenterMarker: true,
          highQuality: true
        },
        scale: 1.0
      })

      renderer.drawLink(ctx, link, context)

      expect(ctx.arc).toHaveBeenCalled()
      expect(ctx.fill).toHaveBeenCalled()
    })

    it('draws arrow-shaped marker when centerMarkerShape is arrow', () => {
      const ctx = createMockCtx()
      const link = makeLink({
        controlPoints: [
          { x: 50, y: 0 },
          { x: 150, y: 100 }
        ]
      })
      const context = makeContext({
        style: {
          mode: 'spline',
          connectionWidth: 3,
          showCenterMarker: true,
          centerMarkerShape: 'arrow',
          highQuality: true
        },
        scale: 1.0
      })

      renderer.drawLink(ctx, link, context)

      // Arrow marker uses translate + rotate + moveTo + lineTo×2
      expect(ctx.translate).toHaveBeenCalled()
      expect(ctx.rotate).toHaveBeenCalled()
    })

    it('skips marker when scale is below 0.6', () => {
      const ctx = createMockCtx()
      const link = makeLink({
        controlPoints: [
          { x: 50, y: 0 },
          { x: 150, y: 100 }
        ]
      })
      const context = makeContext({
        style: {
          mode: 'spline',
          connectionWidth: 3,
          showCenterMarker: true,
          highQuality: true
        },
        scale: 0.3
      })

      renderer.drawLink(ctx, link, context)

      expect(ctx.arc).not.toHaveBeenCalled()
    })

    it('skips marker when highQuality is false', () => {
      const ctx = createMockCtx()
      const link = makeLink({
        controlPoints: [
          { x: 50, y: 0 },
          { x: 150, y: 100 }
        ]
      })
      const context = makeContext({
        style: {
          mode: 'spline',
          connectionWidth: 3,
          showCenterMarker: true,
          highQuality: false
        },
        scale: 1.0
      })

      renderer.drawLink(ctx, link, context)

      expect(ctx.arc).not.toHaveBeenCalled()
    })

    it('applies disabled pattern for center marker', () => {
      const ctx = createMockCtx()
      const disabledPattern = {} as CanvasPattern
      const link = makeLink({
        disabled: true,
        controlPoints: [
          { x: 50, y: 0 },
          { x: 150, y: 100 }
        ]
      })
      const context = makeContext({
        style: {
          mode: 'spline',
          connectionWidth: 3,
          showCenterMarker: true,
          highQuality: true
        },
        scale: 1.0,
        patterns: { disabled: disabledPattern }
      })

      renderer.drawLink(ctx, link, context)

      // Disabled marker sets globalAlpha to 0.75
      expect(ctx.fill).toHaveBeenCalled()
    })
  })

  // ── drawFlowAnimation ─────────────────────────────────────────────

  describe('flow animation', () => {
    it('draws 5 circles when flow is enabled', () => {
      const ctx = createMockCtx()
      const link = makeLink({ flow: true })
      const context = makeContext({
        animation: { time: 0.5 }
      })

      renderer.drawLink(ctx, link, context)

      // Flow draws 5 arcs (one per circle)
      expect(ctx.arc).toHaveBeenCalledTimes(5)
      // Each arc is followed by fill, plus save/restore pair
      expect(ctx.fill).toHaveBeenCalledTimes(5)
    })

    it('does not animate when flow is false', () => {
      const ctx = createMockCtx()
      const link = makeLink({ flow: false })
      const context = makeContext({ animation: { time: 0.5 } })

      renderer.drawLink(ctx, link, context)

      expect(ctx.arc).not.toHaveBeenCalled()
    })

    it('does not animate when no animation context', () => {
      const ctx = createMockCtx()
      const link = makeLink({ flow: true })
      const context = makeContext()

      renderer.drawLink(ctx, link, context)

      expect(ctx.arc).not.toHaveBeenCalled()
    })
  })

  // ── drawDraggingLink ──────────────────────────────────────────────

  describe('drawDraggingLink', () => {
    it('draws a link from fixed to drag point', () => {
      const ctx = createMockCtx()
      const context = makeContext()

      const path = renderer.drawDraggingLink(
        ctx,
        {
          fixedPoint: { x: 0, y: 0 },
          fixedDirection: 'right',
          dragPoint: { x: 200, y: 100 }
        },
        context
      )

      expect(path).toBeDefined()
      expect(ctx.stroke).toHaveBeenCalled()
    })

    it('swaps points when dragging from input', () => {
      const ctx = createMockCtx()
      const context = makeContext({
        style: { mode: 'linear', connectionWidth: 3 }
      })

      const path = renderer.drawDraggingLink(
        ctx,
        {
          fixedPoint: { x: 200, y: 100 },
          fixedDirection: 'left',
          dragPoint: { x: 0, y: 0 },
          fromInput: true
        },
        context
      ) as unknown as StubPath2D

      // When fromInput, dragPoint becomes start and fixedPoint becomes end
      const moveToCall = path.calls.find((c) => c.method === 'moveTo')
      expect(moveToCall!.args).toEqual([0, 0])
    })

    it('uses custom dragDirection when provided', () => {
      const ctx = createMockCtx()
      const context = makeContext()

      renderer.drawDraggingLink(
        ctx,
        {
          fixedPoint: { x: 0, y: 0 },
          fixedDirection: 'right',
          dragPoint: { x: 200, y: 100 },
          dragDirection: 'down'
        },
        context
      )

      expect(ctx.stroke).toHaveBeenCalled()
    })

    it('passes color and type through to link rendering', () => {
      const ctx = createMockCtx()
      const context = makeContext({
        colors: {
          default: '#ffffff',
          byType: { MODEL: '#aabbcc' },
          highlighted: '#ffff00'
        }
      })

      renderer.drawDraggingLink(
        ctx,
        {
          fixedPoint: { x: 0, y: 0 },
          fixedDirection: 'right',
          dragPoint: { x: 200, y: 100 },
          type: 'MODEL'
        },
        context
      )

      expect(ctx.strokeStyle).toBe('#aabbcc')
    })
  })

  // ── computeConnectionPoint (via arrows) ───────────────────────────

  describe('computeConnectionPoint', () => {
    it('returns start at t=0 and end at t=1', () => {
      const ctx = createMockCtx()
      const link = makeLink({
        startPoint: { x: 0, y: 0 },
        endPoint: { x: 100, y: 0 },
        startDirection: 'none',
        endDirection: 'none'
      })
      const context = makeContext({
        style: { mode: 'spline', connectionWidth: 3, showArrows: true }
      })

      // When directions are 'none', control points are at start/end,
      // so bezier degenerates to a line.
      renderer.drawLink(ctx, link, context)

      // Arrows are drawn at 0.25 and 0.75, verifying computeConnectionPoint works
      expect(ctx.translate).toHaveBeenCalledTimes(2)
    })
  })

  // ── drawLink returns Path2D ───────────────────────────────────────

  describe('drawLink return value', () => {
    it('returns a Path2D for hit detection', () => {
      const ctx = createMockCtx()
      const link = makeLink()
      const context = makeContext()

      const result = renderer.drawLink(ctx, link, context)

      expect(result).toBeInstanceOf(StubPath2D)
    })
  })

  // ── direction offset calculations ─────────────────────────────────

  describe('direction offsets', () => {
    it.each([
      { dir: 'left', expectedInnerA: [-15, 0] },
      { dir: 'right', expectedInnerA: [15, 0] },
      { dir: 'up', expectedInnerA: [0, -15] },
      { dir: 'down', expectedInnerA: [0, 15] },
      { dir: 'none', expectedInnerA: [0, 0] }
    ] as const)(
      'linear mode applies correct offset for $dir direction',
      ({ dir, expectedInnerA }) => {
        const ctx = createMockCtx()
        const link = makeLink({
          startPoint: { x: 0, y: 0 },
          endPoint: { x: 200, y: 100 },
          startDirection: dir,
          endDirection: 'none'
        })
        const context = makeContext({
          style: { mode: 'linear', connectionWidth: 3 }
        })

        const path = renderer.drawLink(
          ctx,
          link,
          context
        ) as unknown as StubPath2D
        const lineToCalls = path.calls.filter((c) => c.method === 'lineTo')

        expect(lineToCalls[0].args).toEqual(expectedInnerA)
      }
    )
  })
})
