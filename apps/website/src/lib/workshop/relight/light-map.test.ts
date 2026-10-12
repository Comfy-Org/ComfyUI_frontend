import { describe, expect, it } from 'vitest'

import type { Light } from './lights'
import { newLight } from './lights'
import {
  MAP_CENTER,
  MAP_RIM,
  fromMapPoint,
  mapPoint,
  mapValue,
  nudgeMap,
  toOrbit
} from './light-map'
import { fromOrbit } from './orbit'

const directional = (around: number, height: number): Light => ({
  ...newLight('sun', 'Sun', 0, 'directional'),
  ...fromOrbit(around, height)
})
const point = (x: number, y: number): Light => ({
  ...newLight('bulb', 'Bulb', 0),
  x,
  y
})

describe('toOrbit', () => {
  it.for([
    { around: 0, height: 0 },
    { around: -90, height: 0 },
    { around: 90, height: 30 },
    { around: 170, height: 10 },
    { around: -45, height: -40 }
  ])('undoes fromOrbit at $around° around, $height° up', (orbit) => {
    const { direction, elevation } = fromOrbit(orbit.around, orbit.height)
    const back = toOrbit(direction, elevation)
    expect(back.around).toBeCloseTo(orbit.around, -0.5)
    expect(back.height).toBeCloseTo(orbit.height, -0.5)
  })
})

describe('mapPoint', () => {
  it.for([
    {
      name: 'a light from the camera sits below the subject',
      around: 0,
      height: 0,
      top: { x: MAP_CENTER, y: MAP_CENTER + MAP_RIM },
      side: { x: MAP_CENTER - MAP_RIM, y: MAP_CENTER }
    },
    {
      name: 'a light from the right sits right, level',
      around: 90,
      height: 0,
      top: { x: MAP_CENTER + MAP_RIM, y: MAP_CENTER },
      side: { x: MAP_CENTER - MAP_RIM, y: MAP_CENTER }
    },
    {
      name: 'a light from behind sits above the subject, far side',
      around: 180,
      height: 0,
      top: { x: MAP_CENTER, y: MAP_CENTER - MAP_RIM },
      side: { x: MAP_CENTER + MAP_RIM, y: MAP_CENTER }
    },
    {
      name: 'a light overhead sits at the top of the side view',
      around: 0,
      height: 90,
      top: { x: MAP_CENTER, y: MAP_CENTER + MAP_RIM * 0.45 },
      side: { x: MAP_CENTER, y: MAP_CENTER - MAP_RIM }
    }
  ])('$name', ({ around, height, top, side }) => {
    const light = directional(around, height)
    expect(mapPoint(light, 'top').x).toBeCloseTo(top.x, 0)
    expect(mapPoint(light, 'top').y).toBeCloseTo(top.y, 0)
    expect(mapPoint(light, 'side').x).toBeCloseTo(side.x, 0)
    expect(mapPoint(light, 'side').y).toBeCloseTo(side.y, 0)
  })

  it('puts a point light in front of the subject, where it is in the photo', () => {
    const left = point(0, 0.5)
    const right = point(1, 0.5)
    expect(mapPoint(left, 'top').x).toBeLessThan(MAP_CENTER)
    expect(mapPoint(right, 'top').x).toBeGreaterThan(MAP_CENTER)
    expect(mapPoint(left, 'top').y).toBeGreaterThan(MAP_CENTER)
    expect(mapPoint(point(0.5, 0), 'side').y).toBeLessThan(MAP_CENTER)
    expect(mapPoint(point(0.5, 1), 'side').y).toBeGreaterThan(MAP_CENTER)
    expect(mapPoint(left, 'side').x).toBeLessThan(MAP_CENTER)
  })
})

describe('fromMapPoint', () => {
  it.for([
    { around: -60, height: 20, view: 'top' as const },
    { around: 120, height: 10, view: 'top' as const },
    { around: 30, height: 45, view: 'side' as const },
    { around: -150, height: -20, view: 'side' as const }
  ])(
    'lands a directional light on the dot it was dragged to ($view)',
    ({ around, height, view }) => {
      const target = mapPoint(directional(around, height), view)
      const start = directional(view === 'top' ? 0 : around, height)
      const moved = {
        ...start,
        ...fromMapPoint(start, view, target.x, target.y)
      }
      expect(mapValue(moved, view)).toBeCloseTo(
        view === 'top' ? around : height,
        -0.5
      )
    }
  )

  it('turns round the subject in the top view and keeps the height', () => {
    const light = directional(0, 30)
    const moved = {
      ...light,
      ...fromMapPoint(light, 'top', MAP_CENTER - 20, MAP_CENTER)
    }
    expect(toOrbit(moved.direction, moved.elevation)).toEqual({
      around: -90,
      height: 30
    })
  })

  it('swings a light behind the subject when dragged past the top', () => {
    const light = directional(-40, 30)
    const moved = {
      ...light,
      ...fromMapPoint(light, 'side', MAP_CENTER + 20, MAP_CENTER - 20)
    }
    const { around, height } = toOrbit(moved.direction, moved.elevation)
    expect(Math.abs(around)).toBeGreaterThan(90)
    expect(height).toBeCloseTo(45, -0.5)
  })

  it.for([
    { view: 'top' as const, x: 0, y: 0, patch: { x: 0 } },
    { view: 'top' as const, x: 100, y: 0, patch: { x: 1 } },
    { view: 'top' as const, x: MAP_CENTER, y: 0, patch: { x: 0.5 } },
    { view: 'side' as const, x: 0, y: MAP_CENTER, patch: { y: 0.5 } },
    { view: 'side' as const, x: 0, y: 100, patch: { y: 1 } }
  ])(
    'slides a point light in the $view view to $patch',
    ({ view, x, y, patch }) => {
      expect(fromMapPoint(point(0.3, 0.3), view, x, y)).toEqual(patch)
    }
  )
})

describe('nudgeMap', () => {
  it('turns a directional light round in the top view', () => {
    const light = directional(-60, 20)
    const moved = { ...light, ...nudgeMap(light, 'top', 'ArrowRight') }
    expect(mapValue(moved, 'top')).toBeCloseTo(-55, -0.5)
  })

  it('raises a directional light in the side view, up to overhead', () => {
    const light = directional(10, 88)
    const moved = { ...light, ...nudgeMap(light, 'side', 'ArrowUp') }
    expect(mapValue(moved, 'side')).toBe(90)
  })

  it.for([
    { view: 'top' as const, key: 'ArrowRight', patch: { x: 0.55 } },
    { view: 'top' as const, key: 'ArrowLeft', patch: { x: 0.45 } },
    { view: 'side' as const, key: 'ArrowUp', patch: { y: 0.45 } },
    { view: 'side' as const, key: 'ArrowDown', patch: { y: 0.55 } }
  ])(
    'moves a point light with $key in the $view view',
    ({ view, key, patch }) => {
      const moved = nudgeMap(point(0.5, 0.5), view, key)
      expect(moved?.x ?? moved?.y).toBeCloseTo(patch.x ?? patch.y, 5)
    }
  )

  it('ignores other keys', () => {
    expect(nudgeMap(point(0.5, 0.5), 'top', 'Enter')).toBeUndefined()
  })
})
