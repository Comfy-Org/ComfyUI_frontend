import { describe, expect, it, vi } from 'vitest'

import type { Transform } from '../node'
import type { OutsideCanvasPreviewLayer } from './outsideCanvasPreview'
import { drawOutsideCanvasPreview } from './outsideCanvasPreview'

function layer(transform: Transform, opacity = 1): OutsideCanvasPreviewLayer {
  const bitmap = document.createElement('canvas')
  bitmap.width = 20
  bitmap.height = 20
  return {
    bitmap,
    opacity,
    transform
  }
}

function context(drawImageError?: Error) {
  const drawImage = vi.fn()
  const clearRect = vi.fn()
  const alphaAtDraw: number[] = []
  const alphaStack: number[] = []
  let globalAlpha = 1
  const restore = vi.fn(() => {
    globalAlpha = alphaStack.pop() ?? 1
  })
  const ctx = {
    get globalAlpha() {
      return globalAlpha
    },
    set globalAlpha(value: number) {
      globalAlpha = value
    },
    save: () => alphaStack.push(globalAlpha),
    restore,
    translate: vi.fn(),
    rotate: vi.fn(),
    drawImage: (...args: unknown[]) => {
      alphaAtDraw.push(globalAlpha)
      drawImage(...args)
      if (drawImageError) throw drawImageError
    },
    clearRect
  } as unknown as CanvasRenderingContext2D
  return { ctx, drawImage, clearRect, alphaAtDraw }
}

describe('drawOutsideCanvasPreview', () => {
  const canvas = { w: 100, h: 80 }

  it('does not draw layers contained by the canvas', () => {
    const { ctx, drawImage, clearRect } = context()

    drawOutsideCanvasPreview(ctx, canvas, [
      layer({ x: 10, y: 10, w: 20, h: 20, rotation: 0 })
    ])

    expect(drawImage).not.toHaveBeenCalled()
    expect(clearRect).not.toHaveBeenCalled()
  })

  it('does not draw transparent clipped layers', () => {
    const { ctx, drawImage, clearRect } = context()

    drawOutsideCanvasPreview(ctx, canvas, [
      layer({ x: 90, y: 10, w: 20, h: 20, rotation: 0 }, 0)
    ])

    expect(drawImage).not.toHaveBeenCalled()
    expect(clearRect).not.toHaveBeenCalled()
  })

  it('draws clipped layers at reduced opacity and removes the in-canvas part', () => {
    const { ctx, drawImage, clearRect, alphaAtDraw } = context()

    drawOutsideCanvasPreview(ctx, canvas, [
      layer({ x: 90, y: 10, w: 20, h: 20, rotation: 0 }, 0.5)
    ])

    expect(drawImage).toHaveBeenCalledOnce()
    expect(alphaAtDraw).toEqual([0.2])
    expect(ctx.globalAlpha).toBe(1)
    expect(clearRect).toHaveBeenCalledWith(0, 0, 100, 80)
  })

  it('restores canvas state when drawing fails', () => {
    const drawError = new Error('draw failed')
    const { ctx, clearRect } = context(drawError)

    expect(() =>
      drawOutsideCanvasPreview(ctx, canvas, [
        layer({ x: 90, y: 10, w: 20, h: 20, rotation: 0 })
      ])
    ).toThrow(drawError)
    expect(ctx.globalAlpha).toBe(1)
    expect(clearRect).toHaveBeenCalledWith(0, 0, 100, 80)
  })
})
