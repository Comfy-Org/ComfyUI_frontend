import { describe, expect, it } from 'vitest'

import { hubModelHref, oldModelLinks } from './hub-models'

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

  it('finds links to old model, alias and catalogue addresses, relative or absolute', () => {
    const html = [
      '<a href="/models/bfl--flux-2-max--generate-images/">',
      '<a href="/models/vertexai--gemini-3-pro-image?x=1">',
      '<link rel="canonical" href="https://comfy.org/models/bfl--flux-2-pro--generate-images/">',
      '<a href="/models">',
      '<a href="/models/">',
      '<a href="/hub/models/flux-2-max-text-to-image/">',
      '<a href="/models/workflows/relight/">',
      '<a href="/models/showcase/">',
      '<a href="/modelsfoo/">'
    ].join('')
    expect(oldModelLinks(html)).toEqual([
      '/models/bfl--flux-2-max--generate-images',
      '/models/vertexai--gemini-3-pro-image',
      '/models/bfl--flux-2-pro--generate-images',
      '/models',
      '/models'
    ])
  })

  it.for([
    {
      format: 'page data JSON',
      content:
        '{"href":"/models/bfl--flux-2-max--generate-images/","next":{"href":"/hub/models/flux-2-max-text-to-image/"}}'
    },
    {
      format: 'a markdown twin',
      content:
        '[Flux](https://comfy.org/models/bfl--flux-2-max--generate-images/) and [Hub](https://comfy.org/hub/models/) and [Relight](/models/workflows/relight/)'
    },
    {
      format: 'pretty-printed JSON',
      content: '{\n  "href": "/models/bfl--flux-2-max--generate-images/"\n}'
    }
  ])('finds old model links in $format', ({ content }) => {
    expect(oldModelLinks(content)).toEqual([
      '/models/bfl--flux-2-max--generate-images'
    ])
  })
})
