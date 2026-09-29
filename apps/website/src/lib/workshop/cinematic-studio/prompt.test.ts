import { describe, expect, it } from 'vitest'

import { AUTO_DIRECTION, DEFAULT_DIRECTION } from './catalog'
import type { CinematicBrief } from './prompt'
import { cinematicPrompt, cinematicPromptSegments } from './prompt'

const scene =
  'A woman in a red raincoat waits alone at a night bus stop, rain streaking the glass.'

const brief = (overrides: Partial<CinematicBrief> = {}): CinematicBrief => ({
  scene,
  direction: AUTO_DIRECTION,
  enhance: false,
  cast: false,
  palette: false,
  ...overrides
})

describe('cinematicPrompt', () => {
  it('sends the scene alone when every choice is Auto', () => {
    expect(cinematicPrompt(brief())).toBe(scene)
  })

  it('writes the full direction around the scene', () => {
    expect(
      cinematicPrompt(brief({ direction: DEFAULT_DIRECTION, enhance: true }))
    ).toBe(
      `Medium shot. ${scene} Cinematic film still, natural texture. ` +
        'Shot on large format cinema camera, anamorphic lens, 50mm, f/2.8. ' +
        'Night lit by practical lights, tungsten 500T film, neo-noir look, teal and orange grade.'
    )
  })

  it.for([
    [{ cast: true }, 'Keep the character from reference image 1.'],
    [{ palette: true }, 'Match the color palette of reference image 1.'],
    [
      { cast: true, palette: true },
      'Match the color palette of reference image 2.'
    ]
  ] as const)('numbers references in upload order: %o', ([refs, expected]) => {
    expect(cinematicPrompt(brief(refs))).toContain(expected)
  })

  it('keeps only the camera parts that were chosen', () => {
    const direction = { ...AUTO_DIRECTION, focal: '85' }
    expect(cinematicPrompt(brief({ direction }))).toBe(`${scene} Shot on 85mm.`)
  })

  it('trims the scene and drops it when empty', () => {
    const direction = { ...AUTO_DIRECTION, shot: 'wide' }
    expect(cinematicPrompt(brief({ scene: '   ', direction }))).toBe(
      'Wide shot.'
    )
  })
})

describe('cinematicPromptSegments', () => {
  it('labels which words came from the scene and which from direction', () => {
    const sources = cinematicPromptSegments(
      brief({ direction: DEFAULT_DIRECTION, enhance: true, cast: true })
    ).map((segment) => segment.source)
    expect(sources).toEqual([
      'direction',
      'scene',
      'enhance',
      'direction',
      'direction',
      'reference'
    ])
  })
})
