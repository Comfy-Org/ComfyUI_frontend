import { describe, expect, it } from 'vitest'

import type { Light } from './lights'
import { DEFAULT_SCENE, newLight, newMask } from './lights'
import { heightMap, hexToRgb, shadingUniforms, towardLight } from './shading'

const slots = (values: Float32Array, index: number) =>
  Array.from(values.slice(index * 4, index * 4 + 4), (value) =>
    Number(value.toFixed(5))
  )

describe('hexToRgb', () => {
  it.for([
    { hex: '#ffffff', rgb: [1, 1, 1] },
    { hex: '#000000', rgb: [0, 0, 0] },
    { hex: '#ff8000', rgb: [1, 128 / 255, 0] },
    { hex: 'not a colour', rgb: [1, 1, 1] }
  ])('reads $hex', ({ hex, rgb }) => {
    hexToRgb(hex).forEach((channel, index) =>
      expect(channel).toBeCloseTo(rgb[index])
    )
  })
})

describe('towardLight', () => {
  it.for([
    {
      name: 'shining right comes from the left',
      direction: 0,
      elevation: 0,
      toward: [-1, 0, 0]
    },
    {
      name: 'shining down comes from above',
      direction: 90,
      elevation: 0,
      toward: [0, -1, 0]
    },
    {
      name: 'straight on comes from the camera',
      direction: 30,
      elevation: 90,
      toward: [0, 0, 1]
    },
    {
      name: 'from behind faces away from the camera',
      direction: 0,
      elevation: -90,
      toward: [0, 0, -1]
    }
  ])('$name', ({ direction, elevation, toward }) => {
    towardLight(direction, elevation).forEach((axis, index) =>
      expect(axis).toBeCloseTo(toward[index])
    )
  })
})

describe('heightMap', () => {
  it('reads brighter pixels as higher and smooths the edge between them', () => {
    const width = 8
    const pixels = Array.from({ length: width }, (_, x) =>
      x < 4 ? [0, 0, 0, 255] : [255, 255, 255, 255]
    ).flat()

    const { data } = heightMap(pixels, width, 1, 1)

    expect(data[0]).toBe(0)
    expect(data[7]).toBe(255)
    expect(data[3]).toBeGreaterThan(0)
    expect(data[4]).toBeLessThan(255)
    expect([...data]).toEqual([...data].sort((a, b) => a - b))
  })
})

describe('shadingUniforms', () => {
  const point: Light = { ...newLight('p', 'P', 0), intensity: 50 }
  const directional: Light = {
    ...newLight('d', 'D', 1, 'directional'),
    direction: 90,
    elevation: 0,
    shadows: false,
    color: '#ff0000'
  }

  it('packs only the visible lights, in order', () => {
    const uniforms = shadingUniforms(
      [point, { ...point, id: 'hidden', visible: false }, directional],
      [],
      DEFAULT_SCENE
    )

    expect(uniforms.count).toBe(2)
    expect(slots(uniforms.position, 0)).toEqual([0.5, 0.2, 0, 0.8])
    expect(slots(uniforms.position, 1).slice(2)).toEqual([1, 0.96])
    expect(slots(uniforms.color, 1)).toEqual([1, 0, 0, 0.5])
    expect(slots(uniforms.toward, 1)[1]).toBeCloseTo(-1)
    expect(slots(uniforms.toward, 1)[3]).toBe(0)
  })

  it('keeps a masked light inside its mask and the others on the whole image', () => {
    const mask = newMask('m', 'Subject', 0)
    const uniforms = shadingUniforms(
      [{ ...point, mask: 'm' }, directional],
      [mask],
      DEFAULT_SCENE
    )

    expect(slots(uniforms.mask, 0)).toEqual([
      mask.cx,
      mask.cy,
      mask.rx,
      mask.ry
    ])
    expect(slots(uniforms.mask, 1)).toEqual([0, 0, 0, 0])
  })

  it.for([
    { ambient: 0, color: '#ffffff', expected: [0, 0, 0] },
    { ambient: 100, color: '#ffffff', expected: [0.9, 0.9, 0.9] },
    { ambient: 100, color: '#0000ff', expected: [0, 0, 0.9] }
  ])(
    'tints ambient light $color at $ambient%',
    ({ ambient, color, expected }) => {
      const { ambient: lift } = shadingUniforms([], [], {
        ...DEFAULT_SCENE,
        ambient,
        ambientColor: color
      })
      lift.forEach((channel, index) =>
        expect(channel).toBeCloseTo(expected[index])
      )
    }
  )
})
