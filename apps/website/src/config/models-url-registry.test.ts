import { describe, expect, it } from 'vitest'

import type { ModelsUrlEntry } from './models-url-registry'
import {
  buildModelsUrlRegistry,
  modelsUrlEntries,
  modelsUrlKind,
  unregisteredModelsPaths
} from './models-url-registry'
import {
  workshopDisplayEntries,
  workshopModels
} from './workshop-browse-content'

const hub: ModelsUrlEntry = { path: '/models', kind: 'hub' }

const sources = {
  models: ['acme--image--generate-images'],
  workflows: ['workflows/relight'],
  apps: ['apps/studio'],
  aliases: new Map([['acme--image', 'acme--image--generate-images']])
}

describe('models URL registry', () => {
  it.for<[string, string | undefined]>([
    ['/models/', 'hub'],
    ['/models/acme--image--generate-images/', 'model'],
    ['/models/workflows/relight', 'workflow'],
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

  it('points each alias at the page it redirects to', () => {
    const registry = buildModelsUrlRegistry(modelsUrlEntries(sources))
    expect(registry.entries.get('/models/acme--image')).toEqual({
      path: '/models/acme--image',
      kind: 'alias',
      destination: '/models/acme--image--generate-images'
    })
  })

  it.for<[string, typeof sources]>([
    [
      'a model named like a reserved address',
      { ...sources, models: ['showcase'] }
    ],
    [
      'a workflow and a model on one address',
      { ...sources, models: ['workflows/relight'] }
    ],
    [
      'an alias on a model address',
      {
        ...sources,
        aliases: new Map([
          ['acme--image--generate-images', 'acme--image--generate-images']
        ])
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
      [
        hub,
        { path: '/models/old', kind: 'alias', destination: '/models/missing' }
      ]
    ],
    [
      'another alias',
      [
        hub,
        { path: '/models/new', kind: 'model' },
        { path: '/models/older', kind: 'alias', destination: '/models/old' },
        { path: '/models/old', kind: 'alias', destination: '/models/new' }
      ]
    ],
    [
      'a reserved address',
      [
        hub,
        { path: '/models/showcase', kind: 'reserved' },
        { path: '/models/old', kind: 'alias', destination: '/models/showcase' }
      ]
    ]
  ])('rejects an alias that redirects to %s', ([, entries]) => {
    expect(() => buildModelsUrlRegistry(entries)).toThrow(
      'is not a registered page'
    )
  })

  it.for<[string, ModelsUrlEntry[], string]>([
    ['no hub', [{ path: '/models/new', kind: 'model' }], 'exactly one hub'],
    [
      'two hubs',
      [hub, { path: '/hub/models', kind: 'hub' }],
      'exactly one hub'
    ],
    [
      'an address outside its hub',
      [hub, { path: '/hub/models/new', kind: 'model' }],
      'outside the /models hub'
    ]
  ])('rejects a registry with %s', ([, entries, message]) => {
    expect(() => buildModelsUrlRegistry(entries)).toThrow(message)
  })

  it('treats a trailing slash as the same address', () => {
    expect(() =>
      buildModelsUrlRegistry([
        hub,
        { path: '/models/new/', kind: 'model' },
        { path: '/models/new', kind: 'workflow' }
      ])
    ).toThrow('/models/new is registered twice')
    const registry = buildModelsUrlRegistry([
      hub,
      { path: '/models/new/', kind: 'model' },
      { path: '/models/old/', kind: 'alias', destination: '/models/new/' }
    ])
    expect(modelsUrlKind('/models/old/', registry)).toBe('alias')
    expect(registry.entries.get('/models/old')).toEqual({
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
          'models/acme--image--generate-images/',
          'models/catalogue.json',
          'models/local/',
          'pricing/'
        ],
        registry
      )
    ).toEqual(['/models/local'])
  })

  it('checks built pages against the base the registry was built for', () => {
    const registry = buildModelsUrlRegistry(
      modelsUrlEntries(sources, '/hub/models')
    )
    expect(
      unregisteredModelsPaths(
        [
          'hub/models/',
          'hub/models/acme--image--generate-images/',
          'hub/models/local/',
          'models/local/'
        ],
        registry
      )
    ).toEqual(['/hub/models/local'])
  })

  it('builds the real registry from the Models content', () => {
    const [{ slug: model }] = workshopModels
    const slugOf = (...types: string[]) =>
      workshopDisplayEntries.find(({ type }) => type && types.includes(type))
        ?.slug
    expect(modelsUrlKind(`/models/${model}/`)).toBe('model')
    expect(modelsUrlKind(`/models/${slugOf('APP')}/`)).toBe('app')
    expect(modelsUrlKind(`/models/${slugOf('CLOUD', 'SERVERLESS')}/`)).toBe(
      'workflow'
    )
  })
})
