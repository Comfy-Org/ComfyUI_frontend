import { describe, expect, it } from 'vitest'

import { vfxContent } from './vfx'

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
      expect(
        examples.every(
          ({ media }) => media.type === 'video' && media.tracks?.length
        )
      ).toBe(true)
    }
  )
})
