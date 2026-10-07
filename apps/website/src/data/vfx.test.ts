import { describe, expect, it } from 'vitest'

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
