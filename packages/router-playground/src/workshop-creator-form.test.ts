import { describe, expect, it } from 'vitest'

import { workshopCreatorFormSchema } from './workshop-creator-form'

describe('creator form boundary', () => {
  it.for(['invalid', [], 3])(
    'returns a validation failure instead of throwing for malformed properties: %j',
    (properties) => {
      const result = workshopCreatorFormSchema.safeParse({
        parameters: { type: 'object', properties },
        inputs: {},
        request: { kind: 'callback', callback: 'flat' }
      })
      expect(result.success).toBe(false)
    }
  )
})
