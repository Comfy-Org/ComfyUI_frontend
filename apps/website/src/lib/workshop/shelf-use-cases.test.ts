import { describe, expect, it } from 'vitest'

import type { UseCase } from '../../config/models-catalogue'
import type { Shelf } from './shelf-memory'
import { sectionTitleKeyFor } from './section-title'
import { openedUseCases, shelfOf } from './shelf-use-cases'

const OTHER: UseCase[] = ['text', '3d', 'audio']

describe('a shelf and the use cases it selects', () => {
  it.for<[Shelf, UseCase[]]>([
    ['all', []],
    ['generate-videos', ['generate-videos']],
    ['other', OTHER]
  ])('%s opens as %s', ([shelf, expected]) => {
    expect(openedUseCases(shelf)).toEqual(expected)
  })

  it.for<[UseCase[], Shelf]>([
    [[], 'all'],
    [['generate-videos'], 'generate-videos'],
    [[...OTHER].reverse(), 'other'],
    [['text', '3d'], 'all'],
    [['generate-images', 'edit-images'], 'all']
  ])('%s reads as the %s shelf', ([selected, expected]) => {
    expect(shelfOf(selected)).toBe(expected)
  })

  it('names a shelf it can round-trip', () => {
    for (const shelf of ['all', 'other', 'edit-videos'] as const)
      expect(shelfOf(openedUseCases(shelf))).toBe(shelf)
  })
})

describe('what a selection calls its screen', () => {
  it.for<[UseCase[], string]>([
    [[], 'workshop.sections.allModels'],
    [['audio'], 'workshop.useCase.audio'],
    [[...OTHER], 'workshop.sections.otherFormats'],
    [['text', '3d'], 'workshop.sections.allModels'],
    [['generate-images', 'audio'], 'workshop.sections.allModels']
  ])('%s is titled %s', ([selected, expected]) => {
    expect(sectionTitleKeyFor(selected)).toBe(expected)
  })
})
