import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { tutorialCards } from './tutorialCards'

const publicDir = resolve(__dirname, '../../../../../public')

describe('tutorialCards', () => {
  it.for(tutorialCards)('ships the cover $id points at', ({ thumbnail }) => {
    expect(
      existsSync(`${publicDir}${thumbnail}`),
      'a cover missing from public/ leaves the first-run grid showing the generic template placeholder'
    ).toBe(true)
  })

  it('gives every tutorial its own cover', () => {
    const thumbnails = tutorialCards.map((card) => card.thumbnail)

    expect(
      new Set(thumbnails).size,
      'two tutorials sharing a cover is the mismatch this grid is meant to avoid'
    ).toBe(tutorialCards.length)
  })
})
