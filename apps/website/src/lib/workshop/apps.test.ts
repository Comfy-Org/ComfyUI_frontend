import { describe, expect, it } from 'vitest'

import { appModels } from '../../config/workshop-app-content'
import { workshopAppHref, workshopAppRepo, workshopApps } from './apps'

describe('workshopAppHref', () => {
  it.for([
    { app: 'studio', href: '/hub/apps/cinematic-studio/' },
    { app: 'reshoot', href: '/hub/apps/reshoot/' },
    { app: 'move-anything', href: '/hub/apps/move-anything/' },
    { app: 'relight', href: '/hub/apps/relight/' },
    { app: 'sprite-sheet', href: '/hub/apps/sprite-sheet/' }
  ] as const)('puts $app at $href', ({ app, href }) => {
    expect(workshopAppHref(app, 'en')).toBe(href)
  })

  it('uses the catalogue artwork for every app card', () => {
    expect(workshopApps('en', appModels).map(({ image }) => image)).toEqual(
      appModels.map((app) => app.thumbnail?.url ?? app.thumbnailUrl)
    )
    expect(
      workshopApps('en', appModels).find(({ key }) => key === 'reshoot')?.image
    ).toBe('/images/cinematic-studio/train.jpg')
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
