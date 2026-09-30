import { describe, expect, it } from 'vitest'

import {
  HUB_APPS_PATH,
  HUB_MODELS_PATH,
  HUB_WORKFLOWS_PATH,
  hubAppHref,
  hubAppSlugs,
  hubModelHref,
  oldModelLinks
} from './hub-models'
import { getRoutes } from './routes'

describe('hub model addresses', () => {
  it('agrees with routes.ts on every hub page and app page', () => {
    const routes = getRoutes()
    expect([routes.workshop, routes.hubWorkflows, routes.hubApps]).toEqual([
      `${HUB_MODELS_PATH}/`,
      `${HUB_WORKFLOWS_PATH}/`,
      `${HUB_APPS_PATH}/`
    ])
    expect([routes.cinematicStudio, routes.reshoot]).toEqual(
      hubAppSlugs.map(hubAppHref)
    )
  })

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

  it('finds links to old model, alias, workflow, app and catalogue addresses, relative or absolute', () => {
    const html = [
      '<a href="/models/bfl--flux-2-max--generate-images/">',
      '<a href="/models/vertexai--gemini-3-pro-image?x=1">',
      '<link rel="canonical" href="https://comfy.org/models/bfl--flux-2-pro--generate-images/">',
      '<a href="/models">',
      '<a href="/models/">',
      '<a href="/hub/models/flux-2-max-text-to-image/">',
      '<a href="/models/workflows/change-material/">',
      '<a href="/hub/workflows/change-material/">',
      '<a href="/models/apps/reshoot/">',
      '<a href="/hub/apps/reshoot/">',
      '<a href="/models/showcase/">',
      '<a href="/modelsfoo/">'
    ].join('')
    expect(oldModelLinks(html)).toEqual([
      '/models/bfl--flux-2-max--generate-images',
      '/models/vertexai--gemini-3-pro-image',
      '/models/bfl--flux-2-pro--generate-images',
      '/models',
      '/models',
      '/models/workflows/change-material',
      '/models/apps/reshoot'
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

  it('refuses a slug that has no built page', () => {
    expect(() =>
      hubModelHref('byteplus--seedance-1-0-lite-text-to-video--generate-videos')
    ).toThrow(/No \/hub\/models page/)
  })
})
