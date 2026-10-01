import { describe, expect, it } from 'vitest'

import type { Light } from './lights'
import { MAX_LIGHTS, MOOD_IDS, moodLights, moveLight, newLight } from './lights'

const light: Light = newLight('a', 'A', 0)

describe('moveLight', () => {
  it.for([
    { name: 'moves freely inside the image', dx: 0.1, dy: 0.3, x: 0.6, y: 0.5 },
    { name: 'stops at the left and top edges', dx: -2, dy: -2, x: 0, y: 0 },
    { name: 'stops at the right and bottom edges', dx: 2, dy: 2, x: 1, y: 1 }
  ])('$name', ({ dx, dy, x, y }) => {
    const moved = moveLight(light, dx, dy)
    expect(moved.x).toBeCloseTo(x)
    expect(moved.y).toBeCloseTo(y)
    expect(moved.brightness).toBe(light.brightness)
  })
})

describe('moodLights', () => {
  it('turns a mood into named, visible lights', () => {
    const lights = moodLights('sunset', (key) =>
      key.replace('relight.light.', '')
    )
    expect(
      lights.map(({ id, name, color, visible }) => ({
        id,
        name,
        color,
        visible
      }))
    ).toEqual([
      { id: 'sunset-1', name: 'warmKey', color: 'warm', visible: true },
      { id: 'sunset-2', name: 'coolFill', color: 'cool', visible: true }
    ])
  })

  it('keeps every mood inside the image and within the light limit', () => {
    for (const mood of MOOD_IDS) {
      const lights = moodLights(mood, String)
      expect(lights.length).toBeGreaterThan(0)
      expect(lights.length).toBeLessThanOrEqual(MAX_LIGHTS)
      for (const { x, y } of lights) {
        expect([x, y].every((value) => value >= 0 && value <= 1)).toBe(true)
      }
    }
  })
})

describe('newLight', () => {
  it('places each new light somewhere the last one is not', () => {
    const spots = [0, 1, 2, 3].map((count) => newLight('n', 'N', count))
    expect(new Set(spots.map(({ x, y }) => `${x},${y}`)).size).toBe(4)
  })
})
