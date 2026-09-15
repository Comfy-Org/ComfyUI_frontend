import { describe, expect, it } from 'vitest'

import { zComboInputOptionsValidated } from '@/schemas/nodeDefSchema'

describe('zComboInputOptionsValidated XOR enforcement', () => {
  const remote = {
    route: '/legacy'
  }
  const remote_combo = {
    route: '/rich',
    item_schema: { value_field: 'id', label_field: 'name' }
  }

  it('accepts options without remote or remote_combo', () => {
    const result = zComboInputOptionsValidated.safeParse({})
    expect(result.success).toBe(true)
  })

  it('accepts options with only remote', () => {
    const result = zComboInputOptionsValidated.safeParse({ remote })
    expect(result.success).toBe(true)
  })

  it('accepts options with only remote_combo', () => {
    const result = zComboInputOptionsValidated.safeParse({ remote_combo })
    expect(result.success).toBe(true)
  })

  it('rejects options with both remote and remote_combo', () => {
    const result = zComboInputOptionsValidated.safeParse({
      remote,
      remote_combo
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain(
        'Combo input cannot specify both'
      )
    }
  })
})
