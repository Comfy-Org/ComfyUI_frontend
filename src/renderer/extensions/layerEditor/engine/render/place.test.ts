import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { mipForScale, placeBitmap } from './place'

interface CtxCall {
  op: string
  args: unknown[]
}

const calls: CtxCall[] = []

function recordingStub(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const record =
    (op: string) =>
    (...args: unknown[]) =>
      calls.push({ op, args })
  return {
    canvas,
    imageSmoothingEnabled: false,
    imageSmoothingQuality: 'low',
    save: record('save'),
    restore: record('restore'),
    translate: record('translate'),
    rotate: record('rotate'),
    drawImage: record('drawImage'),
    clearRect: record('clearRect'),
    beginPath: record('beginPath'),
    rect: record('rect'),
    clip: record('clip')
  } as unknown as CanvasRenderingContext2D
}

const origGetContext = HTMLCanvasElement.prototype.getContext

beforeEach(() => {
  calls.length = 0
  HTMLCanvasElement.prototype.getContext = function (
    this: HTMLCanvasElement,
    kind: string
  ) {
    return kind === '2d' ? recordingStub(this) : null
  } as typeof HTMLCanvasElement.prototype.getContext
})

afterEach(() => {
  HTMLCanvasElement.prototype.getContext = origGetContext
})

function canvasOf(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

describe('mipForScale', () => {
  it('returns the bitmap untouched at half scale or above', () => {
    const bitmap = canvasOf(64, 64)
    expect(mipForScale(bitmap, 0.5)).toBe(bitmap)
    expect(mipForScale(bitmap, 1)).toBe(bitmap)
  })

  it('halves once per octave below half scale', () => {
    const bitmap = canvasOf(64, 64)
    const one = mipForScale(bitmap, 0.3) as HTMLCanvasElement
    expect([one.width, one.height]).toEqual([32, 32])
    const three = mipForScale(bitmap, 0.1) as HTMLCanvasElement
    expect([three.width, three.height]).toEqual([8, 8])
  })

  it('caches mip levels per bitmap', () => {
    const bitmap = canvasOf(64, 64)
    expect(mipForScale(bitmap, 0.3)).toBe(mipForScale(bitmap, 0.3))
  })

  it('stops halving at 1px', () => {
    const bitmap = canvasOf(2, 2)
    const mip = mipForScale(bitmap, 0.001) as HTMLCanvasElement
    expect(mip.width).toBe(1)
  })
})

describe('placeBitmap', () => {
  it('sizes the output to the document and draws the transformed bitmap', () => {
    const bitmap = canvasOf(10, 10)
    const out = placeBitmap(
      bitmap,
      { x: 5, y: 5, w: 10, h: 10, rotation: Math.PI / 2 },
      100,
      80
    )
    expect(out?.width).toBe(100)
    expect(out?.height).toBe(80)
    expect(calls.map((c) => c.op)).toEqual([
      'save',
      'clearRect',
      'translate',
      'rotate',
      'drawImage',
      'restore'
    ])
  })

  it('reuses the scratch canvas', () => {
    const bitmap = canvasOf(10, 10)
    const t = { x: 0, y: 0, w: 10, h: 10, rotation: 0 }
    const scratch = placeBitmap(bitmap, t, 50, 50)!
    expect(placeBitmap(bitmap, t, 50, 50, scratch)).toBe(scratch)
  })

  it('clips partial redraws to the dirty rect when the scratch matches', () => {
    const bitmap = canvasOf(10, 10)
    const t = { x: 0, y: 0, w: 10, h: 10, rotation: 0 }
    const scratch = placeBitmap(bitmap, t, 50, 50)!
    calls.length = 0
    placeBitmap(bitmap, t, 50, 50, scratch, { x: 1, y: 2, w: 3, h: 4 })
    const ops = calls.map((c) => c.op)
    expect(ops).toContain('clip')
    const clipRect = calls.find((c) => c.op === 'rect')
    expect(clipRect?.args).toEqual([1, 2, 3, 4])
  })

  it('ignores the clip rect without a matching scratch canvas', () => {
    const bitmap = canvasOf(10, 10)
    placeBitmap(
      bitmap,
      { x: 0, y: 0, w: 10, h: 10, rotation: 0 },
      50,
      50,
      undefined,
      { x: 1, y: 2, w: 3, h: 4 }
    )
    expect(calls.map((c) => c.op)).not.toContain('clip')
  })
})
