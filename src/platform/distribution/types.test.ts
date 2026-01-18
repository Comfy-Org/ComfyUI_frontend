import { describe, expect, it } from 'vitest'

describe('distribution types', () => {
  it('exports isNightly from build flag', async () => {
    const { isNightly } = await import('./types')
    expect(typeof isNightly).toBe('boolean')
  })

  it('exports isCloud and isDesktop', async () => {
    const { isCloud, isDesktop } = await import('./types')
    expect(typeof isCloud).toBe('boolean')
    expect(typeof isDesktop).toBe('boolean')
  })
})
