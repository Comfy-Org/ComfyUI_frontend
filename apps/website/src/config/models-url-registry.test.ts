import { describe, expect, it } from 'vitest'

import type { ModelsUrlEntry } from './models-url-registry'
import {
  buildModelsUrlRegistry,
  modelsUrlEntries,
  modelsUrlKind,
  unregisteredModelsPaths
} from './models-url-registry'

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
    expect(registry.get('/models/acme--image')).toEqual({
      path: '/models/acme--image',
      kind: 'alias',
      target: '/models/acme--image--generate-images'
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
      [{ path: '/models/old', kind: 'alias', target: '/models/missing' }]
    ],
    [
      'another alias',
      [
        { path: '/models/new', kind: 'model' },
        { path: '/models/older', kind: 'alias', target: '/models/old' },
        { path: '/models/old', kind: 'alias', target: '/models/new' }
      ]
    ]
  ])('rejects an alias that redirects to %s', ([, entries]) => {
    expect(() => buildModelsUrlRegistry(entries)).toThrow(
      'is not a registered page'
    )
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

  it('builds the real registry with a page behind every alias', () => {
    expect(modelsUrlKind('/models/bfl--flux-2-max--generate-images/')).toBe(
      'model'
    )
    expect(modelsUrlKind('/models/apps/cinematic-studio/')).toBe('app')
  })
})
