import { describe, expect, it } from 'vitest'

import type { ModelsUrlEntry } from './models-url-registry'
import {
  buildModelsUrlRegistry,
  modelsUrlEntries,
  modelsUrlKind,
  unregisteredModelsPaths
} from './models-url-registry'

const sources = {
  models: new Map([['acme--image--generate-images', 'acme-image']]),
  workflows: ['workflows/relight'],
  apps: ['apps/studio'],
  aliases: new Map([['acme--image', 'acme-image']])
}

describe('models URL registry', () => {
  it.for<[string, string | undefined]>([
    ['/hub/models/', 'hub'],
    ['/models/', 'alias'],
    ['/hub/models/acme-image/', 'model'],
    ['/models/acme--image--generate-images/', 'alias'],
    ['/models/acme--image--generate-images/page.json', 'reserved'],
    ['/hub/workflows/relight/', 'workflow'],
    ['/models/workflows/relight', 'alias'],
    ['/hub/workflows/manifest.json', 'reserved'],
    ['/models/apps/studio/', 'app'],
    ['/models/acme--image', 'alias'],
    ['/models/showcase/', 'reserved'],
    ['/models/catalogue.json', 'reserved'],
    ['/models/workflows/relight/page.json', 'reserved'],
    ['/models/local/', undefined]
  ])('registers %s as %s', ([path, kind]) => {
    const registry = buildModelsUrlRegistry(modelsUrlEntries(sources))
    expect(modelsUrlKind(path, registry)).toBe(kind)
  })

  it.for([
    ['/models', '/hub/models'],
    ['/models/acme--image--generate-images', '/hub/models/acme-image'],
    ['/models/acme--image', '/hub/models/acme-image']
  ])('points %s straight at %s', ([path, destination]) => {
    const registry = buildModelsUrlRegistry(modelsUrlEntries(sources))
    expect(registry.get(path)).toEqual({
      path,
      kind: 'alias',
      destination
    })
  })

  it.for<[string, typeof sources]>([
    [
      'a model named like a reserved address',
      { ...sources, models: new Map([['showcase', 'showcase']]) }
    ],
    [
      'a workflow and a model on one address',
      {
        ...sources,
        models: new Map([['workflows/relight', 'workflows-relight']])
      }
    ],
    [
      'an alias on a model address',
      {
        ...sources,
        aliases: new Map([['acme--image--generate-images', 'acme-image']])
      }
    ]
  ])('rejects %s', ([, collision]) => {
    expect(() => buildModelsUrlRegistry(modelsUrlEntries(collision))).toThrow(
      'is registered twice'
    )
  })

  it.for<[string, ModelsUrlEntry[]]>([
    [
      'an unregistered page',
      [{ path: '/models/old', kind: 'alias', destination: '/models/missing' }]
    ],
    [
      'another alias',
      [
        { path: '/models/new', kind: 'model' },
        { path: '/models/older', kind: 'alias', destination: '/models/old' },
        { path: '/models/old', kind: 'alias', destination: '/models/new' }
      ]
    ]
  ])('rejects an alias that redirects to %s', ([, entries]) => {
    expect(() => buildModelsUrlRegistry(entries)).toThrow(
      'is not a registered page'
    )
  })

  it('treats a trailing slash as the same address', () => {
    expect(() =>
      buildModelsUrlRegistry([
        { path: '/models/new/', kind: 'model' },
        { path: '/models/new', kind: 'workflow' }
      ])
    ).toThrow('/models/new is registered twice')
    const registry = buildModelsUrlRegistry([
      { path: '/models/new/', kind: 'model' },
      { path: '/models/old/', kind: 'alias', destination: '/models/new/' }
    ])
    expect(registry.get('/models/old')).toEqual({
      path: '/models/old',
      kind: 'alias',
      destination: '/models/new'
    })
  })

  it('finds built Models pages that nothing registered', () => {
    const registry = buildModelsUrlRegistry(modelsUrlEntries(sources))
    expect(
      unregisteredModelsPaths(
        [
          '',
          'models/',
          'hub/models/',
          'hub/models/acme-image/',
          'hub/models/stray/',
          'models/catalogue.json',
          'models/local/',
          'pricing/'
        ],
        registry
      )
    ).toEqual(['/hub/models/stray', '/models/local'])
  })

  it('builds the real registry from the Models content', () => {
    expect(modelsUrlKind('/hub/models/flux-2-max-text-to-image/')).toBe('model')
    expect(modelsUrlKind('/models/bfl--flux-2-max--generate-images/')).toBe(
      'alias'
    )
    expect(modelsUrlKind('/models/apps/cinematic-studio/')).toBe('app')
    expect(modelsUrlKind('/hub/workflows/change-material/')).toBe('workflow')
    expect(modelsUrlKind('/models/workflows/change-material/')).toBe('alias')
  })
})
