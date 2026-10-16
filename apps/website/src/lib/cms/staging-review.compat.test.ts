import { describe, expect, it } from 'vitest'
import { z } from 'zod/v3'

import { reviewFilterWith } from './staging-review'

const legacyQuery = z.object({
  search: z.string().max(300).optional(),
  author_uid: z.string().min(1).optional(),
  tags: z.array(z.string().min(1).max(200)).max(30).optional(),
  types: z
    .array(z.enum(['model', 'workflow', 'app', 'media', 'template_set']))
    .max(5)
    .optional(),
  statuses: z
    .array(z.enum(['NEW', 'APPROVED', 'DEFERRED', 'DELETED']))
    .max(4)
    .optional()
})
const filter = reviewFilterWith(legacyQuery)

describe('legacy generated Zod filter compatibility', () => {
  it('validates the new batch field without mixing Zod constructors', () => {
    const value = {
      change_id: 'Workflow-batch',
      tags: ['review'],
      types: ['workflow']
    }
    expect(filter.parse(value)).toEqual(value)
  })

  it.for([
    { unknown: 'x' },
    { change_id: 'bad batch' },
    { change_id: 'a\n' },
    { change_id: ['a', 'b'] },
    { statuses: ['INVALID'] },
    { author_uid: 'invalid account' },
    null,
    [],
    'Batch'
  ])('rejects invalid filter %j', (value) => {
    expect(filter.safeParse(value).success).toBe(false)
  })

  it('does not erase unknown literal keys', () => {
    expect(
      filter.safeParse(
        JSON.parse('{"change_id":"Batch","__proto__":"unknown"}')
      ).success
    ).toBe(false)
  })
})
