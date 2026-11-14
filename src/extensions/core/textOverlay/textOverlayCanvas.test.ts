import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'

import {
  drawTextOverlay,
  layoutTextOverlay,
  loadTextOverlayFont,
  wrapText
} from './textOverlayCanvas'
import type {
  TextMeasurer,
  TextOverlayCanvas,
  TextOverlayParams
} from './textOverlayCanvas'

const ASCENT = 0.7
const DESCENT = 0.2

const halfWidthMeasurer: TextMeasurer = {
  advance: (text, size) => (text.length * size) / 2,
  ink: (_text, size) => ({ ascent: ASCENT * size, descent: DESCENT * size })
}

function layout(overrides: Partial<TextOverlayParams>) {
  return layoutTextOverlay(
    {
      width: 200,
      height: 100,
      text: 'Hi',
      fontSize: 10,
      position: 'top',
      align: 'left',
      outline: true,
      paddingX: 1,
      paddingY: 1,
      ...overrides
    },
    halfWidthMeasurer
  )
}

function inkBox(result: ReturnType<typeof layoutTextOverlay>) {
  const inked = result.lines.filter((line) => line.text)
  return {
    top: inked[0].baseline - ASCENT * result.size - result.stroke,
    bottom: inked.at(-1)!.baseline + DESCENT * result.size + result.stroke
  }
}

describe('wrapText', () => {
  const byLength = (text: string) => text.length

  it.for([
    {
      name: 'fitting text',
      text: 'hello world',
      max: 20,
      expected: ['hello world']
    },
    {
      name: 'at word boundaries',
      text: 'hello world',
      max: 8,
      expected: ['hello', 'world']
    },
    {
      name: 'keeping blank lines',
      text: 'a\n\nb',
      max: 10,
      expected: ['a', '', 'b']
    },
    {
      name: 'splitting an overlong word',
      text: 'abcdefghij',
      max: 4,
      expected: ['abcd', 'efgh', 'ij']
    },
    {
      name: 'flushing before an overlong word',
      text: 'ab abcdefgh',
      max: 4,
      expected: ['ab', 'abcd', 'efgh']
    },
    {
      name: 'collapsing whitespace',
      text: '  spaced \t  out ',
      max: 20,
      expected: ['spaced out']
    }
  ])('wraps $name', ({ text, max, expected }) => {
    expect(wrapText(text, max, byLength)).toEqual(expected)
  })
})

describe('layoutTextOverlay', () => {
  it.for([
    { position: 'top', edge: 'top', expected: 1 },
    { position: 'bottom', edge: 'bottom', expected: 99 }
  ] as const)(
    'sits the ink $edge flush against the margin for $position',
    ({ position, edge, expected }) => {
      expect(inkBox(layout({ position, text: 'one\ntwo' }))[edge]).toBe(
        expected
      )
    }
  )

  it.for([
    { align: 'left', x: 1 },
    { align: 'center', x: 100 },
    { align: 'right', x: 199 }
  ] as const)('anchors $align aligned lines at x=$x', ({ align, x }) => {
    const result = layout({ align, text: 'one\ntwo' })

    expect(result.lines.map((line) => line.x)).toEqual([x, x])
  })

  it.for([
    { outline: true, stroke: 2 },
    { outline: false, stroke: 0 }
  ])(
    'uses a $stroke px stroke when outline is $outline',
    ({ outline, stroke }) => {
      expect(layout({ outline, height: 1000, fontSize: 5 }).stroke).toBe(stroke)
    }
  )

  it('spaces lines at 1.2x the font size', () => {
    const [first, second] = layout({ text: 'one\ntwo', height: 1000 }).lines

    expect(second.baseline - first.baseline).toBe(120)
  })

  it('breaks lines on escaped newlines', () => {
    expect(layout({ text: 'one\\ntwo' }).lines.map((l) => l.text)).toEqual([
      'one',
      'two'
    ])
  })

  it('shrinks the font by 10% steps until the text fits', () => {
    const result = layout({
      width: 1000,
      fontSize: 50,
      outline: false,
      text: 'a\nb\nc'
    })

    expect(result.size).toBe(28)
  })

  it('stops shrinking at the minimum font size', () => {
    const text = Array.from({ length: 20 }, (_, i) => `line ${i}`).join('\n')

    expect(layout({ width: 1000, fontSize: 50, text }).size).toBe(10)
  })

  it.for([
    { align: 'left', x: 20 },
    { align: 'right', x: 180 }
  ] as const)('insets $align aligned text by paddingX', ({ align, x }) => {
    expect(layout({ align, paddingX: 20 }).lines[0].x).toBe(x)
  })

  it.for([
    { position: 'top', edge: 'top', expected: 20 },
    { position: 'bottom', edge: 'bottom', expected: 80 }
  ] as const)(
    'insets the ink $edge by paddingY for $position',
    ({ position, edge, expected }) => {
      expect(inkBox(layout({ position, paddingY: 20 }))[edge]).toBe(expected)
    }
  )

  it.for([
    { paddingX: 1, expected: ['aaaaaaaa bbbbbbbb'] },
    { paddingX: 20, expected: ['aaaaaaaa', 'bbbbbbbb'] }
  ])(
    'wraps within the width left by paddingX=$paddingX',
    ({ paddingX, expected }) => {
      const result = layout({
        text: 'aaaaaaaa bbbbbbbb',
        fontSize: 20,
        paddingX
      })

      expect(result.lines.map((line) => line.text)).toEqual(expected)
    }
  )

  it('rounds the margin half to even like Python', () => {
    const result = layout({ width: 250, height: 250 })

    expect(result.lines[0].x).toBe(2)
  })
})

interface DrawCall {
  kind: 'fill' | 'stroke'
  text: string
  style: string
  lineWidth: number
}

function recordingCanvas() {
  const calls: DrawCall[] = []
  const canvas: TextOverlayCanvas = {
    font: '',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    lineJoin: 'miter',
    lineWidth: 1,
    strokeStyle: '',
    fillStyle: '',
    save: () => {},
    restore: () => {},
    measureText: (text) => ({
      width: text.length * 10,
      actualBoundingBoxAscent: 14,
      actualBoundingBoxDescent: 4
    }),
    fillText(text) {
      calls.push({
        kind: 'fill',
        text,
        style: String(this.fillStyle),
        lineWidth: this.lineWidth
      })
    },
    strokeText(text) {
      calls.push({
        kind: 'stroke',
        text,
        style: String(this.strokeStyle),
        lineWidth: this.lineWidth
      })
    }
  }
  return { canvas, calls }
}

const drawParams = (
  overrides: Partial<TextOverlayParams>
): TextOverlayParams => ({
  width: 1000,
  height: 1000,
  text: 'Hello',
  fontSize: 5,
  position: 'top',
  align: 'left',
  outline: true,
  paddingX: 1,
  paddingY: 1,
  ...overrides
})

describe('drawTextOverlay', () => {
  it('draws nothing for blank text', () => {
    const { canvas, calls } = recordingCanvas()

    drawTextOverlay(canvas, drawParams({ text: '  \n ' }), { color: '#ff0000' })

    expect(calls).toEqual([])
  })

  it('strokes a black outline under the colored text', () => {
    const { canvas, calls } = recordingCanvas()

    drawTextOverlay(canvas, drawParams({}), { color: '#ff0000' })

    expect(calls).toEqual([
      { kind: 'stroke', text: 'Hello', style: '#000000', lineWidth: 4 },
      { kind: 'fill', text: 'Hello', style: '#ff0000', lineWidth: 4 }
    ])
  })

  it('only fills when the outline is off', () => {
    const { canvas, calls } = recordingCanvas()

    drawTextOverlay(canvas, drawParams({ outline: false, text: 'a\n\nb' }), {
      color: '#ffffff'
    })

    expect(calls.map(({ kind, text }) => [kind, text])).toEqual([
      ['fill', 'a'],
      ['fill', 'b']
    ])
  })
})

describe('loadTextOverlayFont', () => {
  it('waits for the declared font once and retries after a failed load', async () => {
    const face = fromPartial<FontFace>({ family: 'ComfyTextOverlayAileron' })
    const load = vi
      .fn<FontFaceSet['load']>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce([])
      .mockResolvedValue([face])
    vi.stubGlobal('document', { fonts: { load } })

    const results = [
      await loadTextOverlayFont(),
      await loadTextOverlayFont(),
      await loadTextOverlayFont(),
      await loadTextOverlayFont()
    ]

    expect(results).toEqual([false, false, true, true])
    expect(load).toHaveBeenCalledTimes(3)
    expect(load).toHaveBeenLastCalledWith('16px ComfyTextOverlayAileron')
  })
})
