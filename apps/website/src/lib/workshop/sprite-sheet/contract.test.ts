import { describe, expect, it } from 'vitest'

import { spriteSheetRequest } from './contract'

describe('spriteSheetRequest', () => {
  it('sends the character, the trimmed animation, the style, the motion and the seed', () => {
    expect(
      spriteSheetRequest('/fox.png', {
        description: '  dancing, soft blink ',
        style: 'toon',
        motion: 'jump',
        seed: 42
      })
    ).toEqual({
      image: '/fox.png',
      description: 'dancing, soft blink',
      style: 'toon',
      motion: 'jump',
      seed: 42
    })
  })
})
