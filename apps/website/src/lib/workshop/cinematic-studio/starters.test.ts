import { describe, expect, it } from 'vitest'

import {
  cameraGroups,
  directionOption,
  gradeGroup,
  lookGroups
} from './catalog'
import { STARTER_SHOTS, findStarter, starterRecipe } from './starters'

const parts = [...cameraGroups, ...lookGroups, gradeGroup].map(
  (group) => group.part
)

describe('STARTER_SHOTS', () => {
  it.for(STARTER_SHOTS)('$id picks only options the studio offers', (shot) => {
    for (const part of parts)
      expect(directionOption(part, shot.direction).id).toBe(
        shot.direction[part]
      )
  })
})

describe('starterRecipe', () => {
  it('names the choices a starter makes and leaves Auto out', () => {
    const portrait = findStarter('portrait')!

    expect(starterRecipe(portrait).map((option) => option.id)).toEqual([
      'prime',
      '85',
      'close',
      'overcast',
      'd250',
      'doc',
      'nordic'
    ])
  })
})

describe('findStarter', () => {
  it.for([
    { id: 'desert', found: true },
    { id: 'nowhere', found: false },
    { id: undefined, found: false }
  ])('finds $id: $found', ({ id, found }) => {
    expect(findStarter(id) !== undefined).toBe(found)
  })
})
