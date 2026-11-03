import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { cachedMeasureText, clearTextMeasureCache } from './textMeasureCache'

function createMockCtx(font = '12px sans-serif'): CanvasRenderingContext2D {
  return fromPartial<CanvasRenderingContext2D>({
    font,
    measureText: vi.fn((text: string) => ({ width: text.length * 7 }))
  })
}

describe('textMeasureCache', () => {
  beforeEach(() => {
    clearTextMeasureCache()
  })

  it('returns the measured width', () => {
    const ctx = createMockCtx()
    const width = cachedMeasureText(ctx, 'hello')
    expect(width).toBe(35)
    expect(ctx.measureText).toHaveBeenCalledWith('hello')
  })

  it('returns cached result on second call without re-measuring', () => {
    const ctx = createMockCtx()
    const first = cachedMeasureText(ctx, 'hello')
    const second = cachedMeasureText(ctx, 'hello')

    expect(first).toBe(second)
    expect(ctx.measureText).toHaveBeenCalledTimes(1)
  })

  it('uses font as part of the cache key', () => {
    const ctx1 = createMockCtx('12px sans-serif')
    const ctx2 = createMockCtx('24px monospace')

    cachedMeasureText(ctx1, 'hello')
    cachedMeasureText(ctx2, 'hello')

    expect(ctx1.measureText).toHaveBeenCalledTimes(1)
    expect(ctx2.measureText).toHaveBeenCalledTimes(1)
  })

  it('clearTextMeasureCache resets the cache', () => {
    const ctx = createMockCtx()
    cachedMeasureText(ctx, 'hello')
    expect(ctx.measureText).toHaveBeenCalledTimes(1)

    clearTextMeasureCache()

    cachedMeasureText(ctx, 'hello')
    expect(ctx.measureText).toHaveBeenCalledTimes(2)
  })

  it('caches different text strings separately', () => {
    const ctx = createMockCtx()
    const w1 = cachedMeasureText(ctx, 'abc')
    const w2 = cachedMeasureText(ctx, 'abcd')

    expect(w1).not.toBe(w2)
    expect(ctx.measureText).toHaveBeenCalledTimes(2)
  })

  it('uses current font metrics throughout loading without a draw', async () => {
    const fontState: { status: FontFaceSet['status'] } = { status: 'loaded' }
    const fonts = Object.assign(new EventTarget(), fontState)
    vi.stubGlobal(
      'document',
      fromPartial<Document>({
        fonts: fromPartial<FontFaceSet>(fonts)
      })
    )
    vi.resetModules()
    const { cachedMeasureText } = await import('./textMeasureCache')
    const ctx = createMockCtx()

    expect(cachedMeasureText(ctx, 'hello')).toBe(35)
    fonts.status = 'loading'
    fonts.dispatchEvent(new Event('loading'))
    expect(cachedMeasureText(ctx, 'hello')).toBe(35)
    expect(cachedMeasureText(ctx, 'ready')).toBe(35)
    vi.mocked(ctx.measureText).mockReturnValue(
      fromPartial<TextMetrics>({ width: 51 })
    )

    expect(cachedMeasureText(ctx, 'hello')).toBe(51)
    fonts.status = 'loaded'
    expect([
      cachedMeasureText(ctx, 'hello'),
      cachedMeasureText(ctx, 'ready')
    ]).toEqual([51, 51])
  })

  it('measures requested fonts without changing subsequent drawing', () => {
    const ctx = createMockCtx('12px sans-serif')
    vi.mocked(ctx.measureText).mockImplementation(() =>
      fromPartial<TextMetrics>({
        width: ctx.font === '24px monospace' ? 83 : 31
      })
    )

    expect([
      cachedMeasureText(ctx, 'hello', '24px monospace'),
      ctx.font,
      cachedMeasureText(ctx, 'hello'),
      cachedMeasureText(ctx, 'hello', '24px monospace'),
      ctx.font
    ]).toEqual([83, '12px sans-serif', 31, 83, '12px sans-serif'])
  })

  it('restores the drawing font when measurement fails', () => {
    const ctx = createMockCtx('12px sans-serif')
    vi.mocked(ctx.measureText).mockImplementationOnce(() => {
      throw new Error('unavailable')
    })

    expect(() => cachedMeasureText(ctx, 'hello', '24px monospace')).toThrow(
      'unavailable'
    )
    expect(ctx.font).toBe('12px sans-serif')
    expect(cachedMeasureText(ctx, 'hello', '24px monospace')).toBe(35)
  })
})
