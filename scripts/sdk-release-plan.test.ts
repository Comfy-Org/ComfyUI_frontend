import { describe, expect, it } from 'vitest'

import { readFileSync } from 'node:fs'

import {
  catalogRanges,
  changedManifestFields,
  changedSchemas,
  referencedSchemas
} from './sdk-release-plan'

const RELEASED = `
export const zCredits = z.object({ amount: z.number() })

/**
 * A plan.
 */
export const zPlan = z.object({ slug: z.string(), credits: zCredits })

export const zCatalogItem = z.object({ id: z.string() })
`

describe('referencedSchemas', () => {
  it('reads schema and type imports, mapping a type to its schema', () => {
    const names = referencedSchemas([
      "import { zPlan, zStatus as Status } from '@comfyorg/ingest-types/zod'",
      "import type { BillingBalance } from '@comfyorg/ingest-types'",
      "import { z } from 'zod'"
    ])

    expect([...names]).toEqual(
      expect.arrayContaining(['zBillingBalance', 'zPlan', 'zStatus'])
    )
    expect(names.size).toBe(3)
  })
})

describe('changedSchemas', () => {
  it.for([
    {
      case: 'a referenced schema changed',
      current: RELEASED.replace('slug: z.string()', 'slug: z.string().min(1)'),
      expected: ['zPlan']
    },
    {
      case: 'a schema the referenced one is built from changed',
      current: RELEASED.replace('amount: z.number()', 'amount: z.int()'),
      expected: ['zCredits']
    },
    {
      case: 'only an unreferenced schema changed',
      current: RELEASED.replace('id: z.string()', 'id: z.uuid()'),
      expected: []
    },
    {
      case: 'only a doc comment changed',
      current: RELEASED.replace('A plan.', 'A plan Cloud offers.'),
      expected: []
    },
    {
      case: 'a referenced schema was added',
      current: `${RELEASED}\nexport const zStatus = z.object({})\n`,
      expected: ['zStatus']
    }
  ])('reports $expected when $case', ({ current, expected }) => {
    expect(changedSchemas(RELEASED, current, ['zPlan', 'zStatus'])).toEqual(
      expected
    )
  })
})

const RELEASED_MANIFEST = {
  name: '@comfyorg/account-ui',
  version: '1.0.0-alpha.0',
  exports: { '.': './src/index.ts' },
  publishConfig: { exports: { '.': './dist/index.js' } },
  scripts: { build: 'vite build' },
  dependencies: { '@comfyorg/account-core': 'workspace:^' },
  devDependencies: { vitest: '^4.0.0' },
  peerDependencies: { '@vueuse/core': '^14.0.0' }
}

describe('changedManifestFields', () => {
  it.for([
    {
      case: 'a peer range was raised',
      current: {
        ...RELEASED_MANIFEST,
        peerDependencies: { '@vueuse/core': '^15.0.0' }
      },
      expected: ['peerDependencies']
    },
    {
      case: 'a published subpath export was added',
      current: {
        ...RELEASED_MANIFEST,
        publishConfig: {
          exports: { '.': './dist/index.js', './checkout': './dist/c.js' }
        }
      },
      expected: ['publishConfig']
    },
    {
      case: 'a dependency was added',
      current: {
        ...RELEASED_MANIFEST,
        dependencies: { ...RELEASED_MANIFEST.dependencies, zod: '^4.0.0' }
      },
      expected: ['dependencies']
    },
    {
      case: 'an optional-peer flag changed',
      current: {
        ...RELEASED_MANIFEST,
        peerDependenciesMeta: { '@vueuse/core': { optional: true } }
      },
      expected: ['peerDependenciesMeta']
    },
    {
      case: 'a source entry behind a published export moved',
      current: { ...RELEASED_MANIFEST, exports: { '.': './src/main.ts' } },
      expected: ['exports']
    },
    {
      case: 'a published field was removed',
      current: { ...RELEASED_MANIFEST, peerDependencies: undefined },
      expected: ['peerDependencies']
    },
    {
      case: 'only version, scripts and devDependencies changed',
      current: {
        ...RELEASED_MANIFEST,
        version: '1.0.0-alpha.1',
        scripts: { build: 'vite build --mode lib' },
        devDependencies: { vitest: '^5.0.0' }
      },
      expected: []
    }
  ])('reports $expected when $case', ({ current, expected }) => {
    expect(
      changedManifestFields(
        JSON.stringify(RELEASED_MANIFEST),
        JSON.stringify(current)
      )
    ).toEqual(expected)
  })

  const catalogManifest = JSON.stringify({
    peerDependencies: { zod: 'catalog:' },
    devDependencies: { vitest: 'catalog:' }
  })
  const workspace = (zod: string, vitest: string) =>
    `packages:\n  - packages/**\n\ncatalog:\n  zod: ${zod}\n  'vitest': '${vitest}'\n\noverrides:\n  zod: 1.0.0\n`

  it.for([
    {
      case: 'the catalog range behind a peer changed',
      current: workspace('^4.1.0', '^4.0.0'),
      expected: ['peerDependencies']
    },
    {
      case: 'only a dev-only catalog range changed',
      current: workspace('^4.0.0', '^5.0.0'),
      expected: []
    }
  ])('reports $expected when $case', ({ current, expected }) => {
    expect(
      changedManifestFields(
        catalogManifest,
        catalogManifest,
        workspace('^4.0.0', '^4.0.0'),
        current
      )
    ).toEqual(expected)
  })
})

describe('catalogRanges', () => {
  it('reads the default catalog of this repository', () => {
    const ranges = catalogRanges(readFileSync('pnpm-workspace.yaml', 'utf8'))

    expect(ranges.get('zod')).toMatch(/^[\^~]?\d/)
    expect(ranges.get('@vueuse/core')).toMatch(/^[\^~]?\d/)
  })
})
