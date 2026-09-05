import { describe, expect, it, vi } from 'vitest'

import type { FillSpec } from '@/renderer/extensions/layerEditor/engine/fill'
import { defaultMode } from '@/renderer/extensions/layerEditor/engine/mode'
import type { BlendFn } from '@/renderer/extensions/layerEditor/engine/mode'
import type {
  FillData,
  RasterData,
  Transform
} from '@/renderer/extensions/layerEditor/engine/node'

import {
  applyLayerState,
  extractLayerState,
  layerStateInputsMatch,
  parseLayerState,
  resolveInitialLayerState
} from './compositorLayerState'
import type { CompositorLayerState } from './compositorLayerState'

function rasterNode(
  id: string,
  name: string,
  overrides: Partial<{
    visible: boolean
    opacity: number
    blend: BlendFn
    transform: Transform
  }> = {}
): RasterData {
  return {
    id,
    kind: 'raster',
    name,
    visible: overrides.visible ?? true,
    opacity: overrides.opacity ?? 1,
    mode: defaultMode(overrides.blend ?? 'normal'),
    transform: overrides.transform ?? { x: 0, y: 0, w: 16, h: 16, rotation: 0 },
    locks: { content: false, position: false, visibility: false },
    contentId: `content-${id}`,
    naturalWidth: 16,
    naturalHeight: 16
  }
}

function fillNode(
  id: string,
  overrides: Partial<{
    fill: FillSpec
    opacity: number
    visible: boolean
  }> = {}
): FillData {
  return {
    id,
    kind: 'fill',
    name: 'Background',
    visible: overrides.visible ?? true,
    opacity: overrides.opacity ?? 1,
    mode: defaultMode('normal'),
    transform: { x: 0, y: 0, w: 0, h: 0, rotation: 0 },
    locks: { content: true, position: true, visibility: false },
    fill: overrides.fill ?? { type: 'solid', color: '#ffffff' }
  }
}

const noFlips = () => ({ h: false, v: false })

function makeOps() {
  return {
    setCanvasSize: vi.fn(),
    setLayerOrder: vi.fn(),
    setBackgroundColor: vi.fn(),
    setBackgroundOpacity: vi.fn(),
    setBackgroundVisible: vi.fn(),
    renameLayer: vi.fn(),
    toggleVisible: vi.fn(),
    setOpacity: vi.fn(),
    setBlendMode: vi.fn(),
    flipLayer: vi.fn(),
    setLayerPosition: vi.fn(),
    setLayerDimensions: vi.fn(),
    setLayerRotationDeg: vi.fn()
  }
}

describe('extractLayerState', () => {
  it('captures canvas size, flips, and per-layer properties', () => {
    const state = extractLayerState(
      { w: 64, h: 48 },
      [
        rasterNode('a', 'Background'),
        rasterNode('b', 'Overlay', {
          visible: false,
          opacity: 0.5,
          blend: 'multiply',
          transform: { x: 4, y: 8, w: 32, h: 24, rotation: Math.PI / 2 }
        })
      ],
      (id) => (id === 'b' ? { h: false, v: true } : { h: false, v: false })
    )

    expect(state).toEqual({
      version: 1,
      canvas: { w: 64, h: 48 },
      layers: [
        {
          name: 'Background',
          visible: true,
          opacity: 1,
          blend: 'normal',
          transform: { x: 0, y: 0, w: 16, h: 16, rotation: 0 },
          flipH: false,
          flipV: false
        },
        {
          name: 'Overlay',
          visible: false,
          opacity: 0.5,
          blend: 'multiply',
          transform: { x: 4, y: 8, w: 32, h: 24, rotation: Math.PI / 2 },
          flipH: false,
          flipV: true
        }
      ]
    })
  })

  it('writes the fill layer as background and keeps it out of the layers array', () => {
    const state = extractLayerState(
      { w: 64, h: 48 },
      [
        fillNode('bg', {
          fill: { type: 'solid', color: '#00df1e' },
          opacity: 0.75,
          visible: false
        }),
        rasterNode('a', 'One')
      ],
      noFlips
    )

    expect(state.background).toEqual({
      color: '#00df1e',
      opacity: 0.75,
      visible: false
    })
    expect(state.layers).toHaveLength(1)
    expect(state.layers[0]).toMatchObject({ name: 'One' })
  })

  it('omits background when no fill layer is present', () => {
    const state = extractLayerState(
      { w: 8, h: 8 },
      [rasterNode('a', 'One')],
      noFlips
    )
    expect('background' in state).toBe(false)
  })

  it('writes layers input-indexed with a stacking order when reordered', () => {
    const state = extractLayerState(
      { w: 8, h: 8 },
      [fillNode('bg'), rasterNode('b', 'B'), rasterNode('a', 'A')],
      noFlips,
      undefined,
      ['a', 'b']
    )
    expect(state.layers.map((entry) => entry?.name)).toEqual(['A', 'B'])
    expect(state.order).toEqual([1, 0])
  })

  it('omits order when stacking matches the input order', () => {
    const state = extractLayerState(
      { w: 8, h: 8 },
      [rasterNode('a', 'A'), rasterNode('b', 'B')],
      noFlips,
      undefined,
      ['a', 'b']
    )
    expect('order' in state).toBe(false)
  })

  it('embeds the inputs fingerprint when provided and omits it otherwise', () => {
    const withInputs = extractLayerState(
      { w: 8, h: 8 },
      [rasterNode('a', 'One')],
      noFlips,
      ['hash-a', 'hash-b']
    )
    expect(withInputs.inputs).toEqual(['hash-a', 'hash-b'])

    const withoutInputs = extractLayerState(
      { w: 8, h: 8 },
      [rasterNode('a', 'One')],
      noFlips
    )
    expect('inputs' in withoutInputs).toBe(false)
  })
})

describe('parseLayerState', () => {
  it('returns null for invalid JSON or non-object payloads', () => {
    expect(parseLayerState('not json')).toBeNull()
    expect(parseLayerState('42')).toBeNull()
    expect(parseLayerState('null')).toBeNull()
    expect(parseLayerState(undefined)).toBeNull()
    expect(parseLayerState(42)).toBeNull()
  })

  it('returns null for empty objects (unset state)', () => {
    expect(parseLayerState({})).toBeNull()
    expect(parseLayerState('{}')).toBeNull()
  })

  it('accepts a plain object directly', () => {
    const state = parseLayerState({ inputs: ['hash-a'], layers: [] })
    expect(state).toEqual({ version: 1, inputs: ['hash-a'], layers: [] })
  })

  it('tolerates missing canvas and layers', () => {
    expect(parseLayerState({ inputs: [] })).toEqual({
      version: 1,
      inputs: [],
      layers: []
    })
  })

  it('accepts the current version and rejects unknown ones', () => {
    expect(parseLayerState({ version: 1, layers: [] })).toEqual({
      version: 1,
      layers: []
    })
    expect(parseLayerState({ version: 2, layers: [] })).toBeNull()
    expect(parseLayerState({ version: 'x', layers: [] })).toBeNull()
  })

  it('returns copies of validated arrays instead of aliasing the input', () => {
    const rawInputs = ['hash-a']
    const rawOrder = [1, 0]
    const state = parseLayerState({
      inputs: rawInputs,
      order: rawOrder,
      layers: [null, null]
    })
    expect(state?.inputs).toEqual(rawInputs)
    expect(state?.inputs).not.toBe(rawInputs)
    expect(state?.order).toEqual(rawOrder)
    expect(state?.order).not.toBe(rawOrder)
  })

  it('surfaces a string-array inputs field', () => {
    const state = parseLayerState(
      JSON.stringify({ inputs: ['hash-a', 'hash-b'], layers: [] })
    )
    expect(state?.inputs).toEqual(['hash-a', 'hash-b'])
  })

  it('drops inputs that are not an array of strings', () => {
    expect(
      parseLayerState(JSON.stringify({ inputs: 'hash-a', layers: [] }))?.inputs
    ).toBeUndefined()
    expect(
      parseLayerState(JSON.stringify({ inputs: { a: 1 }, layers: [] }))?.inputs
    ).toBeUndefined()
    expect(
      parseLayerState(JSON.stringify({ inputs: ['hash-a', 2], layers: [] }))
        ?.inputs
    ).toBeUndefined()
  })

  it('keeps only an order that is a permutation of the layer indices', () => {
    const layers = [null, null]
    expect(
      parseLayerState(JSON.stringify({ order: [1, 0], layers }))?.order
    ).toEqual([1, 0])
    expect(
      parseLayerState(JSON.stringify({ order: [1.5, 0], layers }))?.order
    ).toBeUndefined()
    expect(
      parseLayerState(JSON.stringify({ order: [-1, 0], layers }))?.order
    ).toBeUndefined()
    expect(
      parseLayerState(JSON.stringify({ order: [0, 0], layers }))?.order
    ).toBeUndefined()
    expect(
      parseLayerState(JSON.stringify({ order: [0, 2], layers }))?.order
    ).toBeUndefined()
    expect(
      parseLayerState(JSON.stringify({ order: [0], layers }))?.order
    ).toBeUndefined()
    expect(
      parseLayerState(JSON.stringify({ order: 'first', layers }))?.order
    ).toBeUndefined()
  })

  it('parses background tolerantly, defaulting invalid fields', () => {
    const full = parseLayerState(
      JSON.stringify({
        background: { color: '#112233', opacity: 0.5, visible: false },
        layers: []
      })
    )
    expect(full?.background).toEqual({
      color: '#112233',
      opacity: 0.5,
      visible: false
    })

    const partial = parseLayerState(
      JSON.stringify({
        background: { color: 'nope', opacity: 9, visible: 'x' },
        layers: []
      })
    )
    expect(partial?.background).toEqual({
      color: '#ffffff',
      opacity: 1,
      visible: false
    })

    expect(parseLayerState('{"layers": []}')?.background).toBeUndefined()
  })

  it('defaults flips to false for legacy entries without version or flips', () => {
    const state = parseLayerState(
      JSON.stringify({
        canvas: { w: 10, h: 20 },
        layers: [
          {
            name: 'legacy',
            visible: true,
            opacity: 1,
            blend: 'normal',
            transform: { x: 1, y: 2, w: 3, h: 4, rotation: 0 }
          }
        ]
      })
    )

    expect(state?.layers[0]).toMatchObject({
      name: 'legacy',
      flipH: false,
      flipV: false
    })
  })

  it('parses flips and rejects non-boolean flip values', () => {
    const state = parseLayerState(
      JSON.stringify({
        version: 1,
        layers: [
          {
            name: 'flipped',
            visible: true,
            opacity: 1,
            blend: 'normal',
            transform: { x: 0, y: 0, w: 1, h: 1, rotation: 0 },
            flipH: true,
            flipV: false
          },
          {
            name: 'bad flip',
            visible: true,
            opacity: 1,
            blend: 'normal',
            transform: { x: 0, y: 0, w: 1, h: 1, rotation: 0 },
            flipH: 'yes'
          }
        ]
      })
    )

    expect(state?.layers[0]).toMatchObject({ flipH: true, flipV: false })
    expect(state?.layers[1]).toBeNull()
  })

  it('keeps invalid entries as index-aligned nulls', () => {
    const state = parseLayerState(
      JSON.stringify({
        canvas: { w: 10, h: 20 },
        layers: [
          { name: 'bad blend', visible: true, opacity: 1, blend: 'toString' },
          {
            name: 'ok',
            visible: true,
            opacity: 1,
            blend: 'screen',
            transform: { x: 1, y: 2, w: 3, h: 4, rotation: 0 }
          }
        ]
      })
    )

    expect(state).toEqual({
      version: 1,
      canvas: { w: 10, h: 20 },
      layers: [
        null,
        {
          name: 'ok',
          visible: true,
          opacity: 1,
          blend: 'screen',
          transform: { x: 1, y: 2, w: 3, h: 4, rotation: 0 },
          flipH: false,
          flipV: false
        }
      ]
    })
  })
})

describe('layerStateInputsMatch', () => {
  it('matches only identical fingerprints', () => {
    expect(layerStateInputsMatch(['a', 'b'], ['a', 'b'])).toBe(true)
    expect(layerStateInputsMatch(['a', 'b'], ['a', 'c'])).toBe(false)
    expect(layerStateInputsMatch(['a'], ['a', 'b'])).toBe(false)
    expect(layerStateInputsMatch([], [])).toBe(true)
  })

  it('treats a missing side as a mismatch', () => {
    expect(layerStateInputsMatch(undefined, ['a'])).toBe(false)
    expect(layerStateInputsMatch(['a'], undefined)).toBe(false)
    expect(layerStateInputsMatch(undefined, undefined)).toBe(false)
  })
})

describe('resolveInitialLayerState', () => {
  const savedState: CompositorLayerState = {
    inputs: ['hash-a'],
    layers: [
      {
        name: 'Saved',
        visible: true,
        opacity: 1,
        blend: 'normal',
        transform: { x: 1, y: 2, w: 3, h: 4, rotation: 0 },
        flipH: false,
        flipV: false
      }
    ]
  }
  const bboxes = [
    { x: 10, y: 20, width: 30, height: 40, name: 'Subject' },
    null,
    { x: 0, y: 0, width: 5, height: 5, name: null }
  ]

  it('prefers a saved state with a matching fingerprint over bboxes', () => {
    expect(resolveInitialLayerState(savedState, ['hash-a'], bboxes)).toBe(
      savedState
    )
  })

  it('synthesizes a bbox layout when there is no saved state', () => {
    expect(resolveInitialLayerState(null, ['hash-a'], bboxes)).toEqual({
      layers: [
        {
          name: 'Subject',
          transform: { x: 10, y: 20, w: 30, h: 40, rotation: 0 }
        },
        null,
        { transform: { x: 0, y: 0, w: 5, h: 5, rotation: 0 } }
      ]
    })
  })

  it('synthesizes a bbox layout when the fingerprint mismatches', () => {
    const resolved = resolveInitialLayerState(savedState, ['hash-b'], bboxes)
    expect(resolved?.layers[0]).toEqual({
      name: 'Subject',
      transform: { x: 10, y: 20, w: 30, h: 40, rotation: 0 }
    })
  })

  it('carries the document canvas into the synthesized bbox layout', () => {
    const resolved = resolveInitialLayerState(null, ['hash-a'], bboxes, {
      w: 1280,
      h: 1280
    })
    expect(resolved?.canvas).toEqual({ w: 1280, h: 1280 })
  })

  it('omits the canvas when the backend reports none', () => {
    const resolved = resolveInitialLayerState(null, ['hash-a'], bboxes)
    expect(resolved?.canvas).toBeUndefined()
  })

  it('ignores a malformed canvas', () => {
    const resolved = resolveInitialLayerState(null, ['hash-a'], bboxes, {
      w: Number.NaN,
      h: 1280
    } as { w: number; h: number })
    expect(resolved?.canvas).toBeUndefined()
  })

  it('returns null without a saved state or usable bboxes', () => {
    expect(resolveInitialLayerState(null, undefined, undefined)).toBeNull()
    expect(resolveInitialLayerState(null, undefined, [])).toBeNull()
    expect(resolveInitialLayerState(null, undefined, [null, null])).toBeNull()
    expect(resolveInitialLayerState(savedState, ['hash-b'], [])).toBeNull()
  })
})

describe('applyLayerState', () => {
  it('round-trips an extracted state through JSON onto session ops', () => {
    const extracted = extractLayerState(
      { w: 64, h: 48 },
      [
        rasterNode('a', 'Background'),
        rasterNode('b', 'Overlay', {
          visible: false,
          opacity: 0.5,
          blend: 'multiply',
          transform: { x: 4, y: 8, w: 32, h: 24, rotation: Math.PI }
        })
      ],
      noFlips
    )
    const state = parseLayerState(JSON.stringify(extracted))
    expect(state).not.toBeNull()

    const ops = makeOps()
    applyLayerState(
      state!,
      [
        { id: 'a', visible: true },
        { id: 'b', visible: true }
      ],
      ops
    )

    expect(ops.setCanvasSize).toHaveBeenCalledWith(64, 48)
    expect(ops.renameLayer).toHaveBeenNthCalledWith(1, 'a', 'Background')
    expect(ops.renameLayer).toHaveBeenNthCalledWith(2, 'b', 'Overlay')
    expect(ops.toggleVisible).toHaveBeenCalledTimes(1)
    expect(ops.toggleVisible).toHaveBeenCalledWith('b')
    expect(ops.setOpacity).toHaveBeenCalledWith('b', 0.5)
    expect(ops.setBlendMode).toHaveBeenCalledWith('b', 'multiply')
    expect(ops.flipLayer).not.toHaveBeenCalled()
    expect(ops.setLayerPosition).toHaveBeenCalledWith('b', 4, 8)
    expect(ops.setLayerDimensions).toHaveBeenCalledWith('b', 32, 24)
    expect(ops.setLayerRotationDeg).toHaveBeenCalledWith('b', 180)
  })

  it('restores the saved background through the session setters', () => {
    const ops = makeOps()
    const state = extractLayerState(
      { w: 8, h: 8 },
      [
        fillNode('bg', {
          fill: { type: 'solid', color: '#123456' },
          opacity: 0.4,
          visible: false
        })
      ],
      noFlips
    )

    applyLayerState(state, [], ops)

    expect(ops.setBackgroundColor).toHaveBeenCalledWith('#123456')
    expect(ops.setBackgroundOpacity).toHaveBeenCalledWith(0.4)
    expect(ops.setBackgroundVisible).toHaveBeenCalledWith(false)
  })

  it('resets the background to defaults when the state predates it', () => {
    const ops = makeOps()
    applyLayerState({ layers: [] }, [], ops)

    expect(ops.setBackgroundColor).toHaveBeenCalledWith('#ffffff')
    expect(ops.setBackgroundOpacity).toHaveBeenCalledWith(1)
    expect(ops.setBackgroundVisible).toHaveBeenCalledWith(false)
  })

  it('replays flips per axis before applying the transform', () => {
    const ops = makeOps()
    const state = extractLayerState(
      { w: 8, h: 8 },
      [rasterNode('a', 'One')],
      () => ({ h: true, v: true })
    )

    applyLayerState(state, [{ id: 'a', visible: true }], ops)

    expect(ops.flipLayer).toHaveBeenNthCalledWith(1, 'a', 'h')
    expect(ops.flipLayer).toHaveBeenNthCalledWith(2, 'a', 'v')
    const [flipOrder] = ops.flipLayer.mock.invocationCallOrder
    const [positionOrder] = ops.setLayerPosition.mock.invocationCallOrder
    expect(flipOrder).toBeLessThan(positionOrder)
  })

  it('bails out entirely when the saved layer count differs from the live one', () => {
    const extraSaved = extractLayerState(
      { w: 8, h: 8 },
      [rasterNode('a', 'One'), rasterNode('b', 'Two')],
      noFlips
    )
    const fewerSaved = extractLayerState(
      { w: 8, h: 8 },
      [rasterNode('a', 'One')],
      noFlips
    )

    for (const [state, layers] of [
      [extraSaved, [{ id: 'a', visible: true }]],
      [
        fewerSaved,
        [
          { id: 'a', visible: true },
          { id: 'b', visible: true }
        ]
      ]
    ] as const) {
      const ops = makeOps()
      applyLayerState(state, [...layers], ops)
      expect(ops.renameLayer).not.toHaveBeenCalled()
      expect(ops.setLayerPosition).not.toHaveBeenCalled()
      expect(ops.setLayerOrder).not.toHaveBeenCalled()
    }
  })

  it('reorders layers by mapping order indices to ids, skipping unknown indices', () => {
    const ops = makeOps()
    applyLayerState(
      { layers: [null, null], order: [1, 5, 0] },
      [
        { id: 'a', visible: true },
        { id: 'b', visible: true }
      ],
      ops
    )
    expect(ops.setLayerOrder).toHaveBeenCalledWith(['b', 'a'])
  })

  it('does not reorder when the state has no order', () => {
    const ops = makeOps()
    applyLayerState({ layers: [null] }, [{ id: 'a', visible: true }], ops)
    expect(ops.setLayerOrder).not.toHaveBeenCalled()
  })

  it('drops non-string layout names instead of throwing mid-restore', () => {
    const ops = makeOps()
    const state = resolveInitialLayerState(null, undefined, [
      {
        x: 0,
        y: 0,
        width: 5,
        height: 5,
        name: 7 as unknown as string
      }
    ])
    expect(state).not.toBeNull()

    applyLayerState(state!, [{ id: 'a', visible: true }], ops)

    expect(ops.renameLayer).not.toHaveBeenCalled()
  })

  it('carries initial visibility, opacity, and blend from layer entries', () => {
    const ops = makeOps()
    const state = resolveInitialLayerState(null, undefined, [
      {
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        name: 'Shaded',
        rotation: Math.PI / 2,
        visible: false,
        opacity: 0.5,
        blend: 'multiply',
        flipH: true
      }
    ])
    expect(state).not.toBeNull()

    applyLayerState(state!, [{ id: 'a', visible: true }], ops)

    expect(ops.toggleVisible).toHaveBeenCalledWith('a')
    expect(ops.setOpacity).toHaveBeenCalledWith('a', 0.5)
    expect(ops.setBlendMode).toHaveBeenCalledWith('a', 'multiply')
    expect(ops.flipLayer).toHaveBeenCalledWith('a', 'h')
    expect(ops.setLayerRotationDeg).toHaveBeenCalledWith('a', 90)
  })

  it('applies only the fields present on partial bbox-derived entries', () => {
    const ops = makeOps()
    const state = resolveInitialLayerState(null, undefined, [
      { x: 10, y: 20, width: 30, height: 40, name: 'Subject' },
      null,
      { x: 0, y: 0, width: 5, height: 5 }
    ])
    expect(state).not.toBeNull()

    applyLayerState(
      state!,
      [
        { id: 'a', visible: true },
        { id: 'b', visible: true },
        { id: 'c', visible: true }
      ],
      ops
    )

    expect(ops.setCanvasSize).not.toHaveBeenCalled()
    expect(ops.toggleVisible).not.toHaveBeenCalled()
    expect(ops.setOpacity).not.toHaveBeenCalled()
    expect(ops.setBlendMode).not.toHaveBeenCalled()
    expect(ops.flipLayer).not.toHaveBeenCalled()
    expect(ops.renameLayer).toHaveBeenCalledTimes(1)
    expect(ops.renameLayer).toHaveBeenCalledWith('a', 'Subject')
    expect(ops.setLayerPosition).toHaveBeenCalledWith('a', 10, 20)
    expect(ops.setLayerDimensions).toHaveBeenCalledWith('a', 30, 40)
    expect(ops.setLayerRotationDeg).toHaveBeenCalledWith('a', 0)
    expect(ops.setLayerPosition).toHaveBeenCalledWith('c', 0, 0)
    expect(ops.setLayerDimensions).toHaveBeenCalledWith('c', 5, 5)
    expect(ops.setLayerPosition).not.toHaveBeenCalledWith(
      'b',
      expect.anything(),
      expect.anything()
    )
  })

  it('skips null entries without shifting later indices', () => {
    const ops = makeOps()

    applyLayerState(
      {
        layers: [
          null,
          {
            name: 'Second',
            visible: true,
            opacity: 1,
            blend: 'normal',
            transform: { x: 0, y: 0, w: 1, h: 1, rotation: 0 },
            flipH: false,
            flipV: false
          }
        ]
      },
      [
        { id: 'a', visible: true },
        { id: 'b', visible: true }
      ],
      ops
    )

    expect(ops.setCanvasSize).not.toHaveBeenCalled()
    expect(ops.renameLayer).toHaveBeenCalledTimes(1)
    expect(ops.renameLayer).toHaveBeenCalledWith('b', 'Second')
  })
})
