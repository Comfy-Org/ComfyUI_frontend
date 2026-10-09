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
  })

  it('covers every app card with stills of its outcome, led by its own image', () => {
    const thumbnails = workshopApps('en', appModels).map(
      ({ thumbnail }) => thumbnail
    )
    expect(thumbnails.length).toBeGreaterThan(0)
    expect(thumbnails.map((thumbnail) => thumbnail?.kind)).toEqual(
      thumbnails.map(() => 'image')
    )
    expect(
      thumbnails.every((thumbnail) => (thumbnail?.frames?.length ?? 0) >= 3)
    ).toBe(true)
    expect(thumbnails.map((thumbnail) => thumbnail?.frames?.[0])).toEqual(
      thumbnails.map((thumbnail) => thumbnail?.url)
    )
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
