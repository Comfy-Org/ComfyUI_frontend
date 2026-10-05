import { describe, expect, it } from 'vitest'

import { appModels } from '@/config/workshop-app-content'
import { workshopAppHref, workshopAppRepo, workshopApps } from './apps'

describe('workshopAppHref', () => {
  it.for([
    { app: 'studio', href: '/hub/apps/cinematic-studio/' },
    { app: 'reshoot', href: '/hub/apps/reshoot/' }
  ] as const)('puts $app at $href', ({ app, href }) => {
    expect(workshopAppHref(app, 'en')).toBe(href)
  })

  it('uses the catalogue artwork for every app card', () => {
    expect(
      workshopApps('en', appModels).map(({ thumbnail }) => thumbnail)
    ).toEqual(appModels.map((app) => app.thumbnail))
    expect(
      workshopApps('en', appModels).find(({ key }) => key === 'reshoot')
        ?.thumbnail
    ).toEqual({
      url: 'https://media.comfy.org/website/workshop/apps/reshoot/thumbnail.mp4',
      kind: 'video',
      poster: 'https://media.comfy.org/website/workshop/apps/reshoot/poster.jpg'
    })
  })
})

describe('workshopAppRepo', () => {
  it.for([
    {
      app: 'studio',
      repo: 'https://github.com/Comfy-Org/comfy-cinematic-studio'
    },
    { app: 'reshoot', repo: 'https://github.com/Comfy-Org/comfy-reshoot' }
  ] as const)('links $app to its published repository', ({ app, repo }) => {
    expect(workshopAppRepo(app)).toBe(repo)
  })
})
