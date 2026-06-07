import { beforeEach, describe, expect, it, vi } from 'vitest'

import { cachedMeasureText, clearTextMeasureCache } from './textMeasureCache'
import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/litegraphTestUtils'

describe('textMeasureCache', () => {
  beforeEach(() => {
    clearTextMeasureCache()
  })

  it('returns the measured width', () => {
    const ctx = createMockCanvasRenderingContext2D()
    const width = cachedMeasureText(ctx, 'hello')
    expect(width).toBe(35)
    expect(ctx.measureText).toHaveBeenCalledWith('hello')
  })

  it('returns cached result on second call without re-measuring', () => {
    const ctx = createMockCanvasRenderingContext2D()
    const first = cachedMeasureText(ctx, 'hello')
    const second = cachedMeasureText(ctx, 'hello')

    expect(first).toBe(second)
    expect(ctx.measureText).toHaveBeenCalledTimes(1)
  })

  it('uses font as part of the cache key', () => {
    const ctx1 = createMockCanvasRenderingContext2D({
      font: '12px sans-serif',
      measureText: vi.fn(
        (text: string) =>
          ({
            width: text.length * 7
          }) as TextMetrics
      )
    })

    const ctx2 = createMockCanvasRenderingContext2D({
      font: '24px monospace',
      measureText: vi.fn(
        (text: string) =>
          ({
            width: text.length * 7
          }) as TextMetrics
      )
    })
    cachedMeasureText(ctx1, 'hello')
    cachedMeasureText(ctx2, 'hello')

    expect(ctx1.measureText).toHaveBeenCalledTimes(1)
    expect(ctx2.measureText).toHaveBeenCalledTimes(1)
  })

  it('clearTextMeasureCache resets the cache', () => {
    const ctx = createMockCanvasRenderingContext2D()
    cachedMeasureText(ctx, 'hello')
    expect(ctx.measureText).toHaveBeenCalledTimes(1)

    clearTextMeasureCache()

    cachedMeasureText(ctx, 'hello')
    expect(ctx.measureText).toHaveBeenCalledTimes(2)
  })

  it('caches different text strings separately', () => {
    const ctx = createMockCanvasRenderingContext2D()
    const w1 = cachedMeasureText(ctx, 'abc')
    const w2 = cachedMeasureText(ctx, 'abcd')

    expect(w1).not.toBe(w2)
    expect(ctx.measureText).toHaveBeenCalledTimes(2)
  })
})
