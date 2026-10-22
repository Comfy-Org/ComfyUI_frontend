import { describe, expect, it } from 'vitest'

import {
  hubAppHref,
  hubAppSlugs,
  hubModelSlugs,
  hubWorkflowHref,
  hubWorkflowSlugs
} from './hub-models'
import type { ModelsUrlEntry } from './models-url-registry'
import {
  buildModelsUrlRegistry,
  modelsUrlEntries,
  modelsUrlKind,
  unregisteredModelsPaths
} from './models-url-registry'

const hub: ModelsUrlEntry = { path: '/models', kind: 'hub' }
const roots = ['/models', '/hub/models', '/hub/workflows', '/hub/apps']

const sources = {
  models: new Map([['acme--image--generate-images', 'acme-image']]),
  workflows: ['workflows/relight'],
  apps: ['apps/studio'],
  aliases: new Map([['acme--image', 'acme-image']]),
  localFiles: ['acme-vae']
}

describe('models URL registry', () => {
  it.for<[string, string | undefined]>([
    ['/hub/models/', 'hub'],
    ['/models/', 'alias'],
    ['/hub/workflows/', 'section'],
    ['/hub/apps/', 'section'],
    ['/hub/models/acme-image/', 'model'],
    ['/models/acme--image--generate-images/', 'alias'],
    ['/models/acme--image--generate-images/page.json', 'reserved'],
    ['/hub/workflows/relight/', 'workflow'],
    ['/models/workflows/relight', 'alias'],
    ['/hub/workflows/manifest.json', 'reserved'],
    ['/hub/apps/studio/', 'app'],
    ['/models/apps/studio/', 'alias'],
    ['/models/acme--image', 'alias'],
    ['/models/showcase/', 'reserved'],
    ['/models/catalogue.json', 'reserved'],
    ['/models/workflows/relight/page.json', 'reserved'],
    ['/models/local/', undefined],
    ['/hub/models/local/', 'local'],
    ['/hub/models/local/acme-vae/', 'local'],
    ['/hub/models/local/acme-vae.md', 'reserved'],
    ['/hub/models/local/llms.txt', 'reserved']
  ])('registers %s as %s', ([path, kind]) => {
    const registry = buildModelsUrlRegistry(modelsUrlEntries(sources), roots)
    expect(modelsUrlKind(path, registry)).toBe(kind)
  })

  it.for([
    ['/models', '/hub/models'],
    ['/models/acme--image--generate-images', '/hub/models/acme-image'],
    ['/models/acme--image', '/hub/models/acme-image'],
    ['/models/apps/studio', '/hub/apps/studio']
  ])('points %s straight at %s', ([path, destination]) => {
    const registry = buildModelsUrlRegistry(modelsUrlEntries(sources), roots)
    expect(registry.entries.get(path)).toEqual({
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
    ],
    [
      'a model named like the local files index',
      { ...sources, models: new Map([['acme--local', 'local']]) }
    ],
    [
      'a local file named like the catalog',
      { ...sources, localFiles: ['llms.txt'] }
    ]
  ])('rejects %s', ([, collision]) => {
    expect(() =>
      buildModelsUrlRegistry(modelsUrlEntries(collision), roots)
    ).toThrow('is registered twice')
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
    expect(() => buildModelsUrlRegistry(entries, roots)).toThrow(
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
      'an address outside every root',
      [hub, { path: '/workflows/new', kind: 'model' }],
      '/workflows/new is outside /models, /hub/models, /hub/workflows, /hub/apps'
    ]
  ])('rejects a registry with %s', ([, entries, message]) => {
    expect(() => buildModelsUrlRegistry(entries, roots)).toThrow(message)
  })

  it('treats a trailing slash as the same address', () => {
    expect(() =>
      buildModelsUrlRegistry(
        [
          hub,
          { path: '/models/new/', kind: 'model' },
          { path: '/models/new', kind: 'workflow' }
        ],
        roots
      )
    ).toThrow('/models/new is registered twice')
    const registry = buildModelsUrlRegistry(
      [
        hub,
        { path: '/models/new/', kind: 'model' },
        { path: '/models/old/', kind: 'alias', destination: '/models/new/' }
      ],
      roots
    )
    expect(modelsUrlKind('/models/old/', registry)).toBe('alias')
    expect(registry.entries.get('/models/old')).toEqual({
      path: '/models/old',
      kind: 'alias',
      destination: '/models/new'
    })
  })

  it('finds built Models pages that nothing registered', () => {
    const registry = buildModelsUrlRegistry(modelsUrlEntries(sources), roots)
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

  it('governs every root it is given, with aliases across roots', () => {
    const registry = buildModelsUrlRegistry(
      [
        { path: '/hub/models', kind: 'hub' },
        { path: '/hub/models/y', kind: 'model' },
        { path: '/models', kind: 'alias', destination: '/hub/models' },
        { path: '/models/x', kind: 'alias', destination: '/hub/models/y' }
      ],
      ['/models', '/hub/models']
    )
    expect(modelsUrlKind('/models/x/', registry)).toBe('alias')
    expect(
      unregisteredModelsPaths(
        ['hub/models/y/', 'hub/models/z/', 'models/x/', 'models/w/', 'hub/'],
        registry
      )
    ).toEqual(['/hub/models/z', '/models/w'])
  })

  it('matches built pages when a root ends in a slash', () => {
    const registry = buildModelsUrlRegistry(modelsUrlEntries(sources), [
      '/models/',
      '/hub/models/',
      '/hub/workflows/',
      '/hub/apps/'
    ])
    expect(registry.roots).toEqual([
      '/models',
      '/hub/models',
      '/hub/workflows',
      '/hub/apps'
    ])
    expect(modelsUrlKind('/hub/models/acme-image/', registry)).toBe('model')
    expect(
      unregisteredModelsPaths(
        ['hub/models/', 'hub/models/acme-image/', 'hub/models/stray/'],
        registry
      )
    ).toEqual(['/hub/models/stray'])
  })

  it('builds the real registry from the Models content', () => {
    const [[oldModelId, hubSlug]] = hubModelSlugs
    const [workflow] = hubWorkflowSlugs
    const [app] = hubAppSlugs
    expect(modelsUrlKind(`/hub/models/${hubSlug}/`)).toBe('model')
    expect(modelsUrlKind(`/models/${oldModelId}/`)).toBe('alias')
    expect(modelsUrlKind(hubAppHref(app))).toBe('app')
    expect(modelsUrlKind(`/models/${app}/`)).toBe('alias')
    expect(modelsUrlKind(hubWorkflowHref(workflow))).toBe('workflow')
    expect(modelsUrlKind(`/models/${workflow}/`)).toBe('alias')
  })
})
