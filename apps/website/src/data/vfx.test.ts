import { describe, expect, it, vi } from 'vitest'

import * as learningTutorials from './learningTutorials'
import { vfxContent } from './vfx'

describe('VFX content', () => {
  it.for(['en', 'zh-CN'] as const)(
    'gives %s visitors captioned VFX examples',
    (locale) => {
      const { examples } = vfxContent(locale)
      expect(examples.map(({ id }) => id)).toEqual([
        'sky-replacement',
        'cleanplate-walkthrough'
      ])
      expect(
        examples.every(
          ({ media }) => media.type === 'video' && media.tracks?.length
        )
      ).toBe(true)
    }
  )

  it.for([
    {
      slug: 'sky-replacement',
      message: 'The VFX page requires the sky replacement tutorial'
    },
    {
      slug: 'cleanplate-walkthrough',
      message: 'Missing VFX example: cleanplate-walkthrough'
    }
  ])('rejects a catalog missing $slug', ({ slug, message }) => {
    const tutorials = learningTutorials
      .filterByCategory('vfx')
      .filter((tutorial) => tutorial.slug !== slug)
    vi.spyOn(learningTutorials, 'filterByCategory').mockReturnValue(tutorials)

    expect(() => vfxContent('en')).toThrow(message)
  })

  it('keeps Chinese workflow cards readable when titles are untranslated', () => {
    const tutorials = learningTutorials
      .filterByCategory('vfx')
      .map((tutorial) => ({
        ...tutorial,
        title: { ...tutorial.title, 'zh-CN': '' }
      }))
    vi.spyOn(learningTutorials, 'filterByCategory').mockReturnValue(tutorials)

    const { examples } = vfxContent('zh-CN')

    expect(examples.map(({ media }) => media.alt)).toEqual([
      'Sky Replacement',
      'Cleanplate Walkthrough'
    ])
  })
})
