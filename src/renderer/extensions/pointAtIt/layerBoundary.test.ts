import { describe, expect, it, vi } from 'vitest'

import { plug } from './plug'

const coreSources = import.meta.glob<string>(
  ['./core/**/*.{ts,vue}', './plug.ts'],
  { query: '?raw', import: 'default', eager: true }
)

const APP_OR_OUTSIDE_IMPORT =
  /from\s+['"](@\/|\.\.\/)|import\(\s*['"](@\/|\.\.\/)/

describe('the layer boundary', () => {
  it('keeps app imports out of everything but the host adapter', () => {
    const offenders = Object.entries(coreSources)
      .filter(([, source]) => APP_OR_OUTSIDE_IMPORT.test(source))
      .map(([path]) => path)

    expect(Object.keys(coreSources).length).toBeGreaterThan(10)
    expect(offenders).toEqual([])
  })

  it('registers nothing and mounts nothing while the switch is off', async () => {
    const register = vi.fn()

    await plug(register)

    expect(register).not.toHaveBeenCalled()
    expect(document.body.childElementCount).toBe(0)
  })
})
