import { describe, expect, it } from 'vitest'

import { workshopAppHref } from '../lib/workshop/apps'
import { appModels, appPagePaths } from './workshop-app-content'
import {
  parseAppCatalog,
  parseWorkflowCatalog
} from './workshop-workflow-catalog-schema'

describe('Workshop apps', () => {
  it('lists every app declared in the catalog, each at /hub/apps/<slug>/', () => {
    expect(appModels.map(({ appId, href }) => ({ appId, href }))).toEqual([
      { appId: 'studio', href: '/hub/apps/cinematic-studio/' },
      { appId: 'reshoot', href: '/hub/apps/reshoot/' }
    ])
  })

  it('builds one static page per app, keyed by its slug', () => {
    expect(
      appPagePaths().map(({ params, props }) => [params.app, props.model.appId])
    ).toEqual([
      ['cinematic-studio', 'studio'],
      ['reshoot', 'reshoot']
    ])
  })

  it('opens the page each app links to elsewhere on the site', () => {
    for (const app of appModels)
      expect(app.href).toBe(workshopAppHref(app.appId, 'en'))
  })

  it('keeps app lines out of the workflows and rejects a malformed one', () => {
    const catalog = [
      '{"id":"apps/cinematic-studio","type":"APP","app":"studio"}',
      ''
    ].join('\n')
    expect(parseWorkflowCatalog(catalog)).toEqual([])
    expect(parseAppCatalog(catalog)).toEqual([
      { id: 'apps/cinematic-studio', type: 'APP', app: 'studio' }
    ])
    expect(() =>
      parseAppCatalog('{"id":"apps/x","type":"APP","app":"unknown"}')
    ).toThrow('line 1')
  })
})
