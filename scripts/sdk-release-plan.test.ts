import { describe, expect, it } from 'vitest'

import {
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

describe('changedManifestFields', () => {
  const released = JSON.stringify({
    version: '0.1.0-alpha.1',
    dependencies: { zod: '^3.0.0' },
    peerDependencies: { firebase: '^11.0.0' },
    exports: { '.': './src/index.ts' },
    publishConfig: { exports: { '.': './dist/index.js' } }
  })
  const withChange = (change: object) =>
    JSON.stringify({ ...JSON.parse(released), ...change })

  it.for([
    { change: {}, fields: [] },
    { change: { version: '0.1.0-alpha.2' }, fields: [] },
    { change: { exports: { '.': './src/main.ts' } }, fields: [] },
    { change: { dependencies: { zod: '^4.0.0' } }, fields: ['dependencies'] },
    {
      change: { peerDependencies: { firebase: '^12.0.0' } },
      fields: ['peerDependencies']
    },
    {
      change: {
        publishConfig: {
          exports: { '.': './dist/index.js', './vue': './dist/vue.js' }
        }
      },
      fields: ['publishConfig.exports']
    }
  ])('reports $fields for $change', ({ change, fields }) => {
    expect(changedManifestFields(released, withChange(change))).toEqual(fields)
  })
})
