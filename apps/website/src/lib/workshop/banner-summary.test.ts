import { describe, expect, it } from 'vitest'

import { bannerSummary } from './banner-summary'

describe(bannerSummary, () => {
  it('says a listed model short enough for one line', () => {
    expect(
      bannerSummary(
        'byteplus--seedream-4--generate-images',
        'Generates or edits an image at up to ~4K with up to 10 reference images.'
      )
    ).toBe('Generates or edits an image at up to 4K, from up to 10 references.')
  })

  it('leaves a model nobody has shortened with its own summary', () => {
    expect(bannerSummary('acme--widget--generate-images', 'A long one.')).toBe(
      'A long one.'
    )
  })

  it('keeps a model with no summary without one', () => {
    expect(bannerSummary('acme--widget--generate-images', undefined)).toBe(
      undefined
    )
  })
})
