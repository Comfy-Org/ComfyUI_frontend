import { describe, expect, it } from 'vitest'

import { hubModelHref } from './hub-models'

describe('hub model addresses', () => {
  it('moves a model page under /hub/models by its new slug', () => {
    expect(hubModelHref('bfl--flux-2-max--generate-images')).toBe(
      '/hub/models/flux-2-max-text-to-image/'
    )
  })

  it('sends an alias to the page it stands for', () => {
    expect(hubModelHref('vertexai--gemini-3-pro-image')).toBe(
      '/hub/models/nano-banana-pro-text-to-image/'
    )
  })

  it('refuses a slug that has no built page', () => {
    expect(() =>
      hubModelHref('byteplus--seedance-1-0-lite-text-to-video--generate-videos')
    ).toThrow(/No \/hub\/models page/)
  })
})
