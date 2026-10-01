import { describe, expect, it } from 'vitest'

import { models } from '../../../config/models'
import { modelPageUrls } from '../../../config/model-urls'
import {
  latestVerifiedModelVersions,
  modelVersionReleases
} from './modelVersionReleases'

describe('latest verified model versions', () => {
  it('orders public releases and excludes future releases', () => {
    const releases = latestVerifiedModelVersions(
      modelVersionReleases,
      '2026-09-19'
    )
    expect(releases.map(({ name }) => name)).toEqual([
      'Seedance 2.5',
      'Seedream 5.0 Pro',
      'Nano Banana 2 (Gemini 3.1 Flash Image)'
    ])
  })

  it('keeps quantization variants under one version', () => {
    const qwen = modelVersionReleases.find(
      ({ versionId }) => versionId === 'Qwen/Qwen-Image-2.1'
    )
    expect(qwen).toBeDefined()
    if (!qwen) return
    const releases = latestVerifiedModelVersions(
      [qwen, { ...qwen, variantSlugs: ['another-quantization'] }],
      '2026-10-01'
    )
    expect(releases).toHaveLength(1)
    expect(releases[0]?.name).toBe('Qwen Image 2.1')
  })

  it.for(modelVersionReleases)(
    '$name links to a built individual model',
    (release) => {
      if (release.catalogSlug) {
        expect(models.some(({ slug }) => slug === release.catalogSlug)).toBe(
          true
        )
        expect(release.href).toBe(`/p/supported-models/${release.catalogSlug}/`)
      } else {
        expect(
          modelPageUrls.some(
            ({ newSlug }) => release.href === `/hub/models/${newSlug}/`
          )
        ).toBe(true)
      }
    }
  )
})
