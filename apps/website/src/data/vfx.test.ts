import { describe, expect, it, vi } from 'vitest'

import * as learningTutorials from './learningTutorials'
import { vfxContent, vfxFaqPageNode } from './vfx'

describe('VFX content', () => {
  it.for(['en', 'zh-CN'] as const)(
    'gives %s visitors a tutorial path for every workflow',
    (locale) => {
      const { hero, workflows, examples } = vfxContent(locale)
      const prefix = locale === 'en' ? '' : '/zh-CN'
      expect(workflows).toHaveLength(6)
      expect(workflows.map(({ href }) => href)).toEqual(
        expect.arrayContaining([
          `${prefix}/learning/vfx/sky-replacement/`,
          `${prefix}/learning/vfx/cleanplate-walkthrough/`,
          `${prefix}/learning/vfx/deaging-workflow/`
        ])
      )
      expect(hero.videoSrc).toContain('skyreplacement')
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

    const { workflows, examples } = vfxContent('zh-CN')

    expect(workflows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Sky Replacement',
          href: '/zh-CN/learning/vfx/sky-replacement/',
          media: expect.objectContaining({ alt: 'Sky Replacement' })
        })
      ])
    )
    expect(examples.map(({ media }) => media.alt)).toEqual([
      'Sky Replacement',
      'Cleanplate Walkthrough'
    ])
  })

  it('publishes readable FAQ answers in structured data', () => {
    expect(
      vfxFaqPageNode('https://comfy.org/vfx/', [
        {
          question: 'Where can I open a workflow?',
          answer:
            'Open **your workflow** in [Comfy Cloud](https://cloud.comfy.org/).'
        },
        { question: 'Can I run locally?', answer: 'Yes, with ComfyUI.' }
      ])
    ).toEqual({
      '@type': 'FAQPage',
      '@id': 'https://comfy.org/vfx/#faq',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Where can I open a workflow?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Open your workflow in Comfy Cloud.'
          }
        },
        {
          '@type': 'Question',
          name: 'Can I run locally?',
          acceptedAnswer: { '@type': 'Answer', text: 'Yes, with ComfyUI.' }
        }
      ]
    })
  })
})
