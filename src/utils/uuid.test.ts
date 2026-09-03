import { describe, expect, it, vi } from 'vitest'

import { createUuidv4 } from './uuid'

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('createUuidv4', () => {
  it('uses crypto.randomUUID when available', () => {
    const randomUUID = vi.fn(() => '12345678-1234-4abc-8def-123456789abc')
    const getRandomValues = vi.fn()
    vi.stubGlobal('crypto', { randomUUID, getRandomValues })

    expect(createUuidv4()).toBe('12345678-1234-4abc-8def-123456789abc')
    expect(randomUUID).toHaveBeenCalledOnce()
    expect(getRandomValues).not.toHaveBeenCalled()
  })

  it('uses crypto.getRandomValues when randomUUID is unavailable', () => {
    const getRandomValues = vi.fn((values: Uint32Array) => {
      values.forEach((_, index) => {
        values[index] = index * 2654435761
      })
      return values
    })
    vi.stubGlobal('crypto', { randomUUID: undefined, getRandomValues })

    const uuid = createUuidv4()

    expect(getRandomValues).toHaveBeenCalledOnce()
    expect(uuid).toMatch(UUID_V4_PATTERN)
  })

  it('throws when Web Crypto is unavailable', () => {
    vi.stubGlobal('crypto', undefined)

    expect(() => createUuidv4()).toThrow(
      'Web Crypto is required to generate a UUID'
    )
  })

  it('mints unique UUIDv4 values across a sanity sample', () => {
    const uuids = Array.from({ length: 1_000 }, () => createUuidv4())

    expect(uuids.every((uuid) => UUID_V4_PATTERN.test(uuid))).toBe(true)
    expect(new Set(uuids).size).toBe(uuids.length)
  })
})
