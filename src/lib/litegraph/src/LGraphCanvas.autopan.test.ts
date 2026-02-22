import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraphCanvas } from '@/lib/litegraph/src/litegraph'

type AutopanContext = {
  canvas: { getBoundingClientRect: () => DOMRect }
  _autopanVelocity: [number, number]
  _autopanRAF: number | null
  _autopanLastTime: number
  linkConnector: { isConnecting: boolean }
  ds: { offset: number[]; scale: number }
  setDirty: ReturnType<typeof vi.fn>
  _stopAutopan: () => void
}

const updateVelocity = LGraphCanvas.prototype[
  '_updateAutopanVelocity' as keyof LGraphCanvas
] as (e: PointerEvent) => void

const autopanTick = LGraphCanvas.prototype[
  '_autopanTick' as keyof LGraphCanvas
] as (timestamp: number) => void

const stopAutopan = LGraphCanvas.prototype[
  '_stopAutopan' as keyof LGraphCanvas
] as () => void

const EDGE = LGraphCanvas.AUTOPAN_EDGE_PX
const MAX_SPEED = LGraphCanvas.AUTOPAN_MAX_SPEED

function makeCtx(overrides?: Partial<AutopanContext>): AutopanContext {
  const ctx = {
    canvas: {
      getBoundingClientRect: () => new DOMRect(0, 0, 800, 600)
    },
    _autopanVelocity: [0, 0],
    _autopanRAF: null,
    _autopanLastTime: 0,
    linkConnector: { isConnecting: true },
    ds: { offset: [0, 0], scale: 1 },
    setDirty: vi.fn(),
    ...overrides
  } as AutopanContext
  ctx._stopAutopan = stopAutopan.bind(ctx)
  return ctx
}

function pointerEvent(clientX: number, clientY: number): PointerEvent {
  return { clientX, clientY } as PointerEvent
}

describe('LGraphCanvas autopan', () => {
  let mockRAF: ReturnType<typeof vi.fn>
  let mockCancelRAF: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockRAF = vi.fn().mockReturnValue(42)
    mockCancelRAF = vi.fn()
    vi.stubGlobal('requestAnimationFrame', mockRAF)
    vi.stubGlobal('cancelAnimationFrame', mockCancelRAF)
    vi.stubGlobal('performance', { now: vi.fn().mockReturnValue(0) })
  })

  describe('_updateAutopanVelocity', () => {
    it('sets positive vx when cursor near left edge', () => {
      const ctx = makeCtx()
      updateVelocity.call(ctx, pointerEvent(10, 300))
      expect(ctx._autopanVelocity[0]).toBeCloseTo(
        ((EDGE - 10) / EDGE) * MAX_SPEED
      )
      expect(ctx._autopanVelocity[1]).toBe(0)
    })

    it('sets negative vx when cursor near right edge', () => {
      const ctx = makeCtx()
      updateVelocity.call(ctx, pointerEvent(790, 300))
      const distRight = 800 - 790
      expect(ctx._autopanVelocity[0]).toBeCloseTo(
        -(((EDGE - distRight) / EDGE) * MAX_SPEED)
      )
      expect(ctx._autopanVelocity[1]).toBe(0)
    })

    it('sets positive vy when cursor near top edge', () => {
      const ctx = makeCtx()
      updateVelocity.call(ctx, pointerEvent(400, 5))
      expect(ctx._autopanVelocity[0]).toBe(0)
      expect(ctx._autopanVelocity[1]).toBeCloseTo(
        ((EDGE - 5) / EDGE) * MAX_SPEED
      )
    })

    it('sets negative vy when cursor near bottom edge', () => {
      const ctx = makeCtx()
      updateVelocity.call(ctx, pointerEvent(400, 580))
      const distBottom = 600 - 580
      expect(ctx._autopanVelocity[0]).toBe(0)
      expect(ctx._autopanVelocity[1]).toBeCloseTo(
        -(((EDGE - distBottom) / EDGE) * MAX_SPEED)
      )
    })

    it('sets zero velocity when cursor in center', () => {
      const ctx = makeCtx()
      updateVelocity.call(ctx, pointerEvent(400, 300))
      expect(ctx._autopanVelocity).toEqual([0, 0])
    })

    it('scales linearly with proximity', () => {
      const ctx = makeCtx()

      updateVelocity.call(ctx, pointerEvent(0, 300))
      const atEdge = ctx._autopanVelocity[0]
      expect(atEdge).toBeCloseTo(MAX_SPEED)

      updateVelocity.call(ctx, pointerEvent(EDGE, 300))
      expect(ctx._autopanVelocity[0]).toBe(0)

      updateVelocity.call(ctx, pointerEvent(EDGE / 2, 300))
      expect(ctx._autopanVelocity[0]).toBeCloseTo(MAX_SPEED / 2)
    })

    it('starts rAF loop when velocity becomes non-zero and _autopanRAF is null', () => {
      const ctx = makeCtx()
      updateVelocity.call(ctx, pointerEvent(10, 300))
      expect(mockRAF).toHaveBeenCalledOnce()
      expect(ctx._autopanRAF).toBe(42)
    })

    it('does not start rAF loop when _autopanRAF is already set', () => {
      const ctx = makeCtx({ _autopanRAF: 99 })
      updateVelocity.call(ctx, pointerEvent(10, 300))
      expect(mockRAF).not.toHaveBeenCalled()
      expect(ctx._autopanRAF).toBe(99)
    })

    it('does not start rAF loop when velocity is zero', () => {
      const ctx = makeCtx()
      updateVelocity.call(ctx, pointerEvent(400, 300))
      expect(mockRAF).not.toHaveBeenCalled()
      expect(ctx._autopanRAF).toBeNull()
    })
  })

  describe('_autopanTick', () => {
    it('applies velocity to ds.offset divided by scale', () => {
      const ctx = makeCtx({
        _autopanVelocity: [900, 450],
        _autopanLastTime: 900,
        ds: { offset: [0, 0], scale: 2 }
      })
      autopanTick.call(ctx, 1000)
      const dt = 0.1
      expect(ctx.ds.offset[0]).toBeCloseTo((900 * dt) / 2)
      expect(ctx.ds.offset[1]).toBeCloseTo((450 * dt) / 2)
    })

    it('calls setDirty(true, true)', () => {
      const ctx = makeCtx({
        _autopanVelocity: [100, 0],
        _autopanLastTime: 0
      })
      autopanTick.call(ctx, 16)
      expect(ctx.setDirty).toHaveBeenCalledWith(true, true)
    })

    it('stops when linkConnector.isConnecting is false', () => {
      const ctx = makeCtx({
        _autopanVelocity: [100, 0],
        _autopanLastTime: 0,
        _autopanRAF: 42,
        linkConnector: { isConnecting: false }
      })
      autopanTick.call(ctx, 16)
      expect(ctx._autopanRAF).toBeNull()
      expect(ctx._autopanVelocity).toEqual([0, 0])
      expect(ctx.setDirty).not.toHaveBeenCalled()
    })

    it('stops when velocity is [0, 0]', () => {
      const ctx = makeCtx({
        _autopanVelocity: [0, 0],
        _autopanLastTime: 0,
        _autopanRAF: 42
      })
      autopanTick.call(ctx, 16)
      expect(ctx._autopanRAF).toBeNull()
      expect(ctx.setDirty).not.toHaveBeenCalled()
    })

    it('caps dt at 0.1s', () => {
      const ctx = makeCtx({
        _autopanVelocity: [900, 0],
        _autopanLastTime: 0,
        ds: { offset: [0, 0], scale: 1 }
      })
      autopanTick.call(ctx, 5000)
      expect(ctx.ds.offset[0]).toBeCloseTo(900 * 0.1)
    })
  })

  describe('_stopAutopan', () => {
    it('cancels rAF and sets _autopanRAF to null', () => {
      const ctx = makeCtx({ _autopanRAF: 77 })
      stopAutopan.call(ctx)
      expect(mockCancelRAF).toHaveBeenCalledWith(77)
      expect(ctx._autopanRAF).toBeNull()
    })

    it('resets velocity to [0, 0]', () => {
      const ctx = makeCtx({
        _autopanVelocity: [500, 300],
        _autopanRAF: 77
      })
      stopAutopan.call(ctx)
      expect(ctx._autopanVelocity).toEqual([0, 0])
    })

    it('does not call cancelAnimationFrame when _autopanRAF is null', () => {
      const ctx = makeCtx({ _autopanRAF: null })
      stopAutopan.call(ctx)
      expect(mockCancelRAF).not.toHaveBeenCalled()
    })
  })
})
