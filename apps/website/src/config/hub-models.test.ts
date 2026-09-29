import { describe, expect, it } from 'vitest'

import { hubModelHref } from './hub-models'

describe('hub model addresses', () => {
  it('moves a model page under /hub/models by its new slug', () => {
    expect(hubModelHref('bfl--flux-2-max--generate-images')).toBe(
      '/hub/models/flux-2-max-text-to-image/'
    )
  })
})
