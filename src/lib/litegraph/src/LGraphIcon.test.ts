import { describe, expect, it, vi } from 'vitest'

import { LGraphIcon } from './LGraphIcon'

function createMockCtx(
  overrides: Partial<CanvasRenderingContext2D> = {}
): CanvasRenderingContext2D {
  return {
    font: '12px Arial',
    textBaseline: 'alphabetic',
    textAlign: 'start',
    fillStyle: '#000000',
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillText: vi.fn(),
    drawImage: vi.fn(),
    ...overrides
  } as Partial<CanvasRenderingContext2D> as CanvasRenderingContext2D
}

describe('LGraphIcon', () => {
  describe('constructor', () => {
    it('uses fontSize as size when size is not provided', () => {
      const icon = new LGraphIcon({ unicode: '\ue900', fontSize: 24 })
      expect(icon.size).toBe(24)
    })

    it('uses explicit size when provided', () => {
      const icon = new LGraphIcon({
        unicode: '\ue900',
        fontSize: 24,
        size: 32
      })
      expect(icon.size).toBe(32)
      expect(icon.fontSize).toBe(24)
    })

    it('stores all provided options', () => {
      const image = {} as HTMLImageElement
      const icon = new LGraphIcon({
        unicode: '\ue900',
        fontFamily: 'CustomFont',
        image,
        color: '#ff0000',
        bgColor: '#00ff00',
        fontSize: 20,
        size: 28,
        circlePadding: 4,
        xOffset: 5,
        yOffset: -3
      })

      expect(icon.unicode).toBe('\ue900')
      expect(icon.fontFamily).toBe('CustomFont')
      expect(icon.image).toBe(image)
      expect(icon.color).toBe('#ff0000')
      expect(icon.bgColor).toBe('#00ff00')
      expect(icon.fontSize).toBe(20)
      expect(icon.size).toBe(28)
      expect(icon.circlePadding).toBe(4)
      expect(icon.xOffset).toBe(5)
      expect(icon.yOffset).toBe(-3)
    })
  })

  describe('draw with unicode', () => {
    it('renders text with correct font and color', () => {
      const icon = new LGraphIcon({
        unicode: '\ue900',
        fontFamily: 'TestFont',
        color: '#ff0000',
        fontSize: 20
      })
      const ctx = createMockCtx()

      icon.draw(ctx, 10, 50)

      expect(ctx.fillText).toHaveBeenCalledWith(
        '\ue900',
        10 + 20 / 2 + 2, // x + iconRadius (fontSize/2 + circlePadding)
        50
      )
      expect(ctx.font).toBe('12px Arial')
      expect(ctx.fillStyle).toBe('#000000')
    })

    it('restores all canvas state after drawing', () => {
      const icon = new LGraphIcon({ unicode: '\ue900' })
      const ctx = createMockCtx({
        font: 'original-font',
        textBaseline: 'bottom',
        textAlign: 'right',
        fillStyle: 'purple'
      })

      icon.draw(ctx, 0, 0)

      expect(ctx.font).toBe('original-font')
      expect(ctx.textBaseline).toBe('bottom')
      expect(ctx.textAlign).toBe('right')
      expect(ctx.fillStyle).toBe('purple')
    })

    it('draws circle background when bgColor is set', () => {
      const icon = new LGraphIcon({
        unicode: '\ue900',
        bgColor: '#333333',
        fontSize: 16,
        circlePadding: 2
      })
      const ctx = createMockCtx()

      icon.draw(ctx, 10, 50)

      const expectedRadius = 16 / 2 + 2
      expect(ctx.beginPath).toHaveBeenCalled()
      expect(ctx.arc).toHaveBeenCalledWith(
        10 + expectedRadius,
        50,
        expectedRadius,
        0,
        2 * Math.PI
      )
      expect(ctx.fill).toHaveBeenCalled()
    })

    it('does not draw circle background when bgColor is not set', () => {
      const icon = new LGraphIcon({ unicode: '\ue900' })
      const ctx = createMockCtx()

      icon.draw(ctx, 10, 50)

      expect(ctx.beginPath).not.toHaveBeenCalled()
      expect(ctx.arc).not.toHaveBeenCalled()
    })

    it('applies xOffset and yOffset to draw position', () => {
      const icon = new LGraphIcon({
        unicode: '\ue900',
        fontSize: 16,
        circlePadding: 2,
        xOffset: 5,
        yOffset: -3
      })
      const ctx = createMockCtx()

      icon.draw(ctx, 10, 50)

      const iconRadius = 16 / 2 + 2
      expect(ctx.fillText).toHaveBeenCalledWith(
        '\ue900',
        15 + iconRadius, // (10 + 5) + iconRadius
        47 // 50 + (-3)
      )
    })
  })

  describe('draw with image', () => {
    it('calls drawImage with correct dimensions', () => {
      const image = {} as HTMLImageElement
      const icon = new LGraphIcon({ image, size: 24, circlePadding: 2 })
      const ctx = createMockCtx()

      icon.draw(ctx, 10, 50)

      const expectedImageX = 10 + 2 // x + circlePadding
      const expectedImageY = 50 - 24 / 2 // y - iconSize/2
      expect(ctx.drawImage).toHaveBeenCalledWith(
        image,
        expectedImageX,
        expectedImageY,
        24,
        24
      )
    })

    it('draws circle background when bgColor is set', () => {
      const image = {} as HTMLImageElement
      const icon = new LGraphIcon({
        image,
        size: 24,
        bgColor: '#444444',
        circlePadding: 2
      })
      const ctx = createMockCtx()

      icon.draw(ctx, 10, 50)

      const expectedRadius = 24 / 2 + 2
      expect(ctx.beginPath).toHaveBeenCalled()
      expect(ctx.arc).toHaveBeenCalledWith(
        10 + expectedRadius,
        50,
        expectedRadius,
        0,
        2 * Math.PI
      )
      expect(ctx.fill).toHaveBeenCalled()
      expect(ctx.drawImage).toHaveBeenCalled()
    })

    it('restores fillStyle after drawing background circle', () => {
      const image = {} as HTMLImageElement
      const icon = new LGraphIcon({
        image,
        size: 24,
        bgColor: '#444444'
      })
      const ctx = createMockCtx({ fillStyle: 'original' })

      icon.draw(ctx, 0, 0)

      expect(ctx.fillStyle).toBe('original')
    })

    it('prioritizes image over unicode when both are provided', () => {
      const image = {} as HTMLImageElement
      const icon = new LGraphIcon({ image, unicode: '\ue900', size: 20 })
      const ctx = createMockCtx()

      icon.draw(ctx, 0, 0)

      expect(ctx.drawImage).toHaveBeenCalled()
      expect(ctx.fillText).not.toHaveBeenCalled()
    })

    it('applies offsets to image draw position', () => {
      const image = {} as HTMLImageElement
      const icon = new LGraphIcon({
        image,
        size: 20,
        circlePadding: 2,
        xOffset: 3,
        yOffset: 7
      })
      const ctx = createMockCtx()

      icon.draw(ctx, 10, 50)

      expect(ctx.drawImage).toHaveBeenCalledWith(
        image,
        13 + 2, // (10+3) + circlePadding
        57 - 10, // (50+7) - size/2
        20,
        20
      )
    })
  })

  describe('draw with no icon', () => {
    it('does nothing when neither unicode nor image is provided', () => {
      const icon = new LGraphIcon({})
      const ctx = createMockCtx()

      icon.draw(ctx, 10, 50)

      expect(ctx.fillText).not.toHaveBeenCalled()
      expect(ctx.drawImage).not.toHaveBeenCalled()
      expect(ctx.beginPath).not.toHaveBeenCalled()
    })
  })
})
