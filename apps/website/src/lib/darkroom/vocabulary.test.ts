import { describe, expect, it } from 'vitest'

import {
  creativityKey,
  DEFAULT_DARKROOM_SETTINGS,
  restoreDarkroomSettings,
  runsAllowed,
  shapeRatio
} from './vocabulary'

describe('runsAllowed', () => {
  // Router reports how many calls an account may have in flight.
  it.for([
    [undefined, 4],
    [-1, 4],
    [40, 4],
    [5, 4],
    [3, 3],
    [1, 1],
    [0, 0]
  ] as const)('a limit of %s allows %s images a prompt', ([limit, runs]) => {
    expect(runsAllowed(limit)).toBe(runs)
  })
})

describe('restoreDarkroomSettings', () => {
  it('falls back to the defaults for anything that is not an object', () => {
    expect(restoreDarkroomSettings(null)).toEqual(DEFAULT_DARKROOM_SETTINGS)
    expect(restoreDarkroomSettings('2K')).toEqual(DEFAULT_DARKROOM_SETTINGS)
  })

  it('keeps known values and drops unknown ones', () => {
    expect(
      restoreDarkroomSettings({
        model: 'vertexai/gemini-3-pro-image',
        runs: 9,
        shape: '9:16',
        size: '8K',
        format: 'image/jpeg',
        seed: '1234',
        planning: 'LOW',
        temperature: 1.4,
        styleNotes: 'soft grain'
      })
    ).toEqual({
      model: 'vertexai/gemini-3-pro-image',
      runs: 4,
      shape: '9:16',
      size: '2K',
      format: 'image/jpeg',
      seed: '1234',
      planning: '',
      temperature: 1.4,
      styleNotes: 'soft grain'
    })
  })

  it('ignores a model that is no longer offered', () => {
    expect(restoreDarkroomSettings({ model: 'vertexai/retired' }).model).toBe(
      DEFAULT_DARKROOM_SETTINGS.model
    )
  })
})

describe('creativityKey', () => {
  it.for([
    [0, 'steady'],
    [0.5, 'focused'],
    [1, 'balanced'],
    [1.3, 'loose'],
    [2, 'wild']
  ] as const)('names a temperature of %s %s', ([temperature, key]) => {
    expect(creativityKey(temperature)).toBe(key)
  })
})

describe('shapeRatio', () => {
  it('reads a shape as width over height, and auto as square', () => {
    expect(shapeRatio('16:9')).toBeCloseTo(16 / 9)
    expect(shapeRatio('auto')).toBe(1)
    expect(shapeRatio(undefined)).toBe(1)
  })
})
