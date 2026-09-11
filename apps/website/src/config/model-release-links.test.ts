import { describe, expect, it } from 'vitest'

import { modelReleaseSlides } from '../data/modelRelease'
import { workshopModels } from './models-catalogue'
import { modelReleaseLinks } from './model-release-links'

describe('homepage Models destinations', () => {
  it('does not override any existing release destination while disabled', async () => {
    expect(await modelReleaseLinks(false)).toEqual({})
  })

  it('overrides only available models with canonical detail links while enabled', async () => {
    const links = await modelReleaseLinks(true)
    for (const [id, href] of Object.entries(links)) {
      expect(modelReleaseSlides.some((slide) => slide.id === id)).toBe(true)
      expect(workshopModels.some((model) => model.href === href)).toBe(true)
    }
    expect(links['seedance-2-5']).toBe(
      '/models/byteplus--seedance-2-5-text-to-video--generate-videos/'
    )
    expect(links['wan-animate-2']).toBeUndefined()
  })
})
