import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  generateCanvasPatternImage,
  getEffectiveCanvasBackgroundColor,
  getPatternMarkColor
} from '@/utils/canvasPatternUtil'

interface RecordingContext {
  fillStyle: string
  strokeStyle: string
  lineWidth: number
  groundColor: string
  fillRect: ReturnType<typeof vi.fn>
  beginPath: ReturnType<typeof vi.fn>
  arc: ReturnType<typeof vi.fn>
  fill: ReturnType<typeof vi.fn>
  moveTo: ReturnType<typeof vi.fn>
  lineTo: ReturnType<typeof vi.fn>
  stroke: ReturnType<typeof vi.fn>
}

function createRecordingContext(): RecordingContext {
  const ctx: RecordingContext = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    groundColor: '',
    fillRect: vi.fn(() => {
      ctx.groundColor = ctx.fillStyle
    }),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn()
  }
  return ctx
}

let contexts: RecordingContext[]
let getContextSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  contexts = []
  getContextSpy = vi
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockImplementation(() => {
      const ctx = createRecordingContext()
      contexts.push(ctx)
      return ctx as unknown as GPUCanvasContext
    })
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
    'data:image/png;base64,sentinel'
  )
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('getPatternMarkColor', () => {
  it('uses faint light marks on dark backgrounds', () => {
    expect(getPatternMarkColor('#141414')).toBe('rgba(255, 255, 255, 0.10)')
    expect(getPatternMarkColor('#0000ff')).toBe('rgba(255, 255, 255, 0.10)')
  })

  it('uses faint dark marks on light backgrounds', () => {
    expect(getPatternMarkColor('#f0f0f0')).toBe('rgba(0, 0, 0, 0.13)')
    expect(getPatternMarkColor('#ffffff')).toBe('rgba(0, 0, 0, 0.13)')
  })
})

describe('getEffectiveCanvasBackgroundColor', () => {
  it('prefers the user setting over the palette color', () => {
    expect(getEffectiveCanvasBackgroundColor('aabbcc', '#222222')).toBe(
      '#aabbcc'
    )
  })

  it('falls back to the palette color when the setting is empty', () => {
    expect(getEffectiveCanvasBackgroundColor('', '#222222')).toBe('#222222')
  })

  it('accepts a #-prefixed stored value', () => {
    expect(getEffectiveCanvasBackgroundColor('#aabbcc', '#222222')).toBe(
      '#aabbcc'
    )
  })

  it('normalizes a non-hex palette color to a hex string', () => {
    const result = getEffectiveCanvasBackgroundColor('', 'lightgray')
    expect(result).toMatch(/^#[0-9a-f]{6}$/)
  })
})

describe('generateCanvasPatternImage', () => {
  it('fills the ground with the background color and draws no marks for none', () => {
    generateCanvasPatternImage('none', '#101010')
    const ctx = contexts.at(-1)!
    expect(ctx.fillRect).toHaveBeenCalledExactlyOnceWith(0, 0, 100, 100)
    expect(ctx.groundColor).toBe('#101010')
    expect(ctx.arc).not.toHaveBeenCalled()
    expect(ctx.stroke).not.toHaveBeenCalled()
  })

  it('draws a 5x5 grid of dots for the dots pattern', () => {
    generateCanvasPatternImage('dots', '#111111')
    const ctx = contexts.at(-1)!
    expect(ctx.arc).toHaveBeenCalledTimes(25)
    expect(ctx.fill).toHaveBeenCalledTimes(25)
    expect(ctx.stroke).not.toHaveBeenCalled()
  })

  it('draws 5 vertical and 5 horizontal lines for the grid pattern', () => {
    generateCanvasPatternImage('grid', '#121212')
    const ctx = contexts.at(-1)!
    expect(ctx.stroke).toHaveBeenCalledTimes(10)
    expect(ctx.arc).not.toHaveBeenCalled()
  })

  it('returns a data URI', () => {
    expect(generateCanvasPatternImage('dots', '#131313')).toBe(
      'data:image/png;base64,sentinel'
    )
  })

  it('strips alpha from 8-digit hex backgrounds', () => {
    generateCanvasPatternImage('dots', '#101010ff')
    expect(contexts.at(-1)!.groundColor).toBe('#101010')
  })

  it('memoizes tiles per pattern and color', () => {
    generateCanvasPatternImage('grid', '#151515')
    const callsAfterFirst = getContextSpy.mock.calls.length
    generateCanvasPatternImage('grid', '#151515')
    expect(getContextSpy.mock.calls.length).toBe(callsAfterFirst)
  })
})
