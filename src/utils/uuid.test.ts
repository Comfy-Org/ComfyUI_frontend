import { afterEach, describe, expect, it, vi } from 'vitest'

import { createUuidv4 } from './uuid'

describe('uuid utilities', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('uses crypto.randomUUID when available', () => {
    const randomUUID = vi.fn(() => 'native-uuid')
    const getRandomValues = vi.fn()
    vi.stubGlobal('crypto', { randomUUID, getRandomValues })

    expect(createUuidv4()).toBe('native-uuid')
    expect(randomUUID).toHaveBeenCalledOnce()
    expect(getRandomValues).not.toHaveBeenCalled()
  })

  it('falls back to crypto.getRandomValues', () => {
    const getRandomValues = vi.fn((storage: Uint32Array) => storage.fill(0))
    vi.stubGlobal('crypto', { getRandomValues })

    expect(createUuidv4()).toBe('10000000-1000-4000-8000-100000000000')
    expect(getRandomValues).toHaveBeenCalledWith(expect.any(Uint32Array))
  })

  it('falls back to Math.random when crypto is unavailable', () => {
    vi.stubGlobal('crypto', undefined)
    vi.spyOn(Math, 'random').mockReturnValue(0)

    expect(createUuidv4()).toBe('10000000-1000-4000-8000-100000000000')
  })
})
