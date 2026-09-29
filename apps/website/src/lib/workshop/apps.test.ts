import { describe, expect, it } from 'vitest'

import { appModels } from '../../config/workshop-app-content'
import { workshopAppHref, workshopAppRepo, workshopApps } from './apps'

describe('workshopAppHref', () => {
  it.for([
    { app: 'studio', href: '/models/apps/cinematic-studio/' },
    { app: 'reshoot', href: '/models/apps/reshoot/' }
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
  it.for(['studio', 'reshoot'] as const)(
    'has no repository for $0 until one is published',
    (app) => {
      expect(workshopAppRepo(app)).toBeUndefined()
    }
  )
})
