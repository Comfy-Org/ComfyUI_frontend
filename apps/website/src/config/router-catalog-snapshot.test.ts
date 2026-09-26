import { describe, expect, it } from 'vitest'

import {
  DOCS_REPO,
  buildRouterCatalogSnapshot
} from './router-catalog-snapshot'

const sourceCommit = 'a'.repeat(40)

const modelsMarkdown = [
  '- [Alpha](/development/comfy-router/models/acme/alpha-1/code): `acme/alpha-1`',
  '- [Beta Two](/development/comfy-router/models/acme/beta.two/code): `acme/beta.two`',
  'Also [Alpha](/development/comfy-router/models/acme/alpha-1/code) again.'
].join('\n')

const providersMarkdown = [
  '## Provider coverage',
  '',
  '| Model / provider | **Comfy (default)** | **fal** | **Higgsfield** |',
  '| --- | --- | --- | --- |',
  '| [Alpha](/development/comfy-router/models/acme/alpha-1/code) | ✓ | ✓ | - |'
].join('\n')

describe('buildRouterCatalogSnapshot', () => {
  it('counts each generated catalog link once and keeps provider coverage', async () => {
    const snapshot = await buildRouterCatalogSnapshot({
      sourceCommit,
      modelsMarkdown,
      providersMarkdown,
      readSchema: async () => ({
        'x-comfy-router-alt-providers': [{ provider: 'fal', model_id: 'x' }]
      })
    })

    expect(snapshot).toEqual({
      sourceRepo: DOCS_REPO,
      sourceCommit,
      models: [
        {
          id: 'acme/alpha-1',
          docsPath: '/development/comfy-router/models/acme/alpha-1/code',
          name: 'Alpha'
        },
        {
          id: 'acme/beta.two',
          docsPath: '/development/comfy-router/models/acme/beta.two/code',
          name: 'Beta Two'
        }
      ],
      providerCoverage: {
        providers: ['fal', 'Higgsfield'],
        rows: [
          {
            name: 'Alpha',
            docsPath: '/development/comfy-router/models/acme/alpha-1/code',
            id: 'acme/alpha-1',
            comfy: '✓',
            providers: ['fal'],
            altProviders: ['fal']
          }
        ]
      }
    })
  })

  it('rejects a catalog link that is not a named model line', async () => {
    await expect(
      buildRouterCatalogSnapshot({
        sourceCommit,
        modelsMarkdown: [
          '- [Alpha](/development/comfy-router/models/acme/alpha-1/code): `acme/alpha-1`',
          'comfy-router/models/other/orphan'
        ].join('\n'),
        providersMarkdown,
        readSchema: async () => ({})
      })
    ).rejects.toThrow(/2 model links and 1 named lines/)
  })
})
