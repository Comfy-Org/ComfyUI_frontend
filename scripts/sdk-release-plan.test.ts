import { describe, expect, it } from 'vitest'

import { changedSchemas, referencedSchemas } from './sdk-release-plan'

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
