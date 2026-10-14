import { describe, expect, it } from 'vitest'
import { accountID } from './account-id'

describe('canonical Comfy account IDs', () => {
  it.for([
    'fPc7irbKt2VLbuIkRrWuC5TH5lX2',
    '11111111-AAAA-4111-8111-111111111111',
    'opaque-Account:Case-Sensitive',
    'account-longer-than-a-resource-uuid-1234567890'
  ])('preserves the exact account ID %s', (id) => {
    expect(accountID.parse(id)).toBe(id)
  })

  it.for([
    '',
    ' ',
    ' with-space',
    'line\nbreak',
    'control\u0000',
    'unicode\u2003space',
    '\ud800',
    '00000000-0000-0000-0000-000000000000'
  ])(
    'rejects blank, malformed or control-bearing account identity %j',
    (id) => {
      expect(accountID.safeParse(id).success).toBe(false)
    }
  )
})
