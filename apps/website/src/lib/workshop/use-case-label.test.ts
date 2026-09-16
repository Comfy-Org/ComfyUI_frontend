import { describe, expect, it } from 'vitest'

import { t } from '../../i18n/translations'
import { useCaseLabelKey } from './use-case-label'

const expected = [
  ['all', 'workshop.useCase.all'],
  ['other', 'workshop.sections.otherFormats'],
  ['generate-images', 'workshop.useCase.generateImages'],
  ['edit-images', 'workshop.useCase.editImages'],
  ['generate-videos', 'workshop.useCase.generateVideos'],
  ['animate-images', 'workshop.useCase.animateImages'],
  ['edit-videos', 'workshop.useCase.editVideos'],
  ['3d', 'workshop.useCase.3d'],
  ['audio', 'workshop.useCase.audio'],
  ['text', 'workshop.useCase.text']
] as const

describe('useCaseLabelKey', () => {
  it('maps every catalogue use case to its intended translated label', () => {
    expect(useCaseLabelKey).toEqual(Object.fromEntries(expected))

    for (const [useCase, key] of expected) {
      expect(useCaseLabelKey[useCase]).toBe(key)
      expect(t(useCaseLabelKey[useCase], 'en')).not.toBe('')
    }
  })
})
