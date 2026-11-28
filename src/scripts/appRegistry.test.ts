import { describe, expect, it, vi } from 'vitest'

import { app } from '@/scripts/app'
import { registerApp, useApp } from '@/scripts/appRegistry'

vi.mock(import('@/scripts/app'))

describe('appRegistry', () => {
  it('throws before registration', async () => {
    vi.resetModules()
    const fresh = await import('@/scripts/appRegistry')
    expect(() => fresh.useApp()).toThrow('ComfyApp accessed before registerApp')
  })

  it('returns the registered instance', () => {
    registerApp(app)
    expect(useApp()).toBe(app)
  })
})
