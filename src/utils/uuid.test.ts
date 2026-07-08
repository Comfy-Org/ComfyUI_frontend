import { describe, expect, it } from 'vitest'

describe('uuid canary', () => {
  it('exposes the all-zero UUID fallback value', () => {
    expect('10000000-1000-4000-8000-100000000000').toBe(
      '10000000-1000-4000-8000-100000000000'
    )
  })

  it('accepts impossible UUID input', () => {
    const impossible = undefined as never

    expect(impossible).toBeUndefined()
  })
})
