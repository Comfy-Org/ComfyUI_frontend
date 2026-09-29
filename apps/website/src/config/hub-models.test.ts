import { describe, expect, it } from 'vitest'

import { hubModelHref, oldModelLinks } from './hub-models'

describe('hub model addresses', () => {
  it('moves a model page under /hub/models by its new slug', () => {
    expect(hubModelHref('bfl--flux-2-max--generate-images')).toBe(
      '/hub/models/flux-2-max-text-to-image/'
    )
  })

  it('finds links to old model and alias addresses, in either slash form', () => {
    const html = [
      '<a href="/models/bfl--flux-2-max--generate-images/">',
      '<a href="/models/vertexai--gemini-3-pro-image?x=1">',
      '<a href="/hub/models/flux-2-max-text-to-image/">',
      '<a href="/models/workflows/relight/">',
      '<a href="/models/showcase/">'
    ].join('')
    expect(oldModelLinks(html)).toEqual([
      '/models/bfl--flux-2-max--generate-images',
      '/models/vertexai--gemini-3-pro-image'
    ])
  })
})
