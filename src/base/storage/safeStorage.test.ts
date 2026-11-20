import { afterEach, describe, expect, it, vi } from 'vitest'

import { createSafeStorage } from './safeStorage'

type StorageGlobal = 'localStorage' | 'sessionStorage'

const originals = new Map<StorageGlobal, PropertyDescriptor | undefined>()

function denyAccess(name: StorageGlobal) {
  if (!originals.has(name))
    originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
  Object.defineProperty(globalThis, name, {
    configurable: true,
    get() {
      throw new DOMException('Access is denied', 'SecurityError')
    }
  })
}

afterEach(() => {
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor)
    else Reflect.deleteProperty(globalThis, name)
  }
  originals.clear()
})

describe('createSafeStorage', () => {
  it('uses localStorage when it is readable', () => {
    const storage = createSafeStorage(['localStorage', 'sessionStorage'])

    expect(storage.setItem('k', 'v')).toBe('ok')
    expect(storage.backend).toBe('localStorage')
    expect(storage.isPersistent).toBe(true)
    expect(localStorage.getItem('k')).toBe('v')
    expect(storage.isStorageArea(localStorage)).toBe(true)
    expect(storage.isStorageArea(sessionStorage)).toBe(false)
  })

  it('fails over to sessionStorage when reading localStorage throws', () => {
    denyAccess('localStorage')
    const storage = createSafeStorage(['localStorage', 'sessionStorage'])

    expect(storage.setItem('k', 'v')).toBe('ok')
    expect(storage.backend).toBe('sessionStorage')
    expect(sessionStorage.getItem('k')).toBe('v')
  })

  it('fails over to memory when every native backend is denied', () => {
    denyAccess('localStorage')
    denyAccess('sessionStorage')
    const storage = createSafeStorage(['localStorage', 'sessionStorage'])

    expect(storage.setItem('a', '1')).toBe('ok')
    expect(storage.setItem('b', '2')).toBe('ok')
    expect(storage.getItem('a')).toBe('1')
    expect(storage.keys()).toEqual(['a', 'b'])
    storage.removeItem('a')
    expect(storage.getItem('a')).toBeNull()
    expect(storage.backend).toBe('memory')
    expect(storage.isPersistent).toBe(false)
  })

  it('degrades to memory without throwing when access is revoked after resolution', () => {
    const storage = createSafeStorage(['localStorage'])
    expect(storage.backend).toBe('localStorage')

    denyAccess('localStorage')

    expect(storage.getItem('k')).toBeNull()
    expect(storage.setItem('k', 'v')).toBe('ok')
    expect(storage.getItem('k')).toBe('v')
    expect(() => storage.removeItem('k')).not.toThrow()
    expect(storage.backend).toBe('memory')
    expect(storage.isPersistent).toBe(false)
  })

  it('moves to the next readable backend while access is revoked', () => {
    const storage = createSafeStorage(['localStorage', 'sessionStorage'])
    expect(storage.backend).toBe('localStorage')

    denyAccess('localStorage')

    expect(storage.setItem('k', 'v')).toBe('ok')
    expect(storage.backend).toBe('sessionStorage')
    expect(sessionStorage.getItem('k')).toBe('v')
  })

  it('returns to the resolved backend once access is restored', () => {
    const storage = createSafeStorage(['localStorage', 'sessionStorage'])
    expect(storage.backend).toBe('localStorage')
    denyAccess('localStorage')
    expect(storage.backend).toBe('sessionStorage')

    const descriptor = originals.get('localStorage')
    if (descriptor)
      Object.defineProperty(globalThis, 'localStorage', descriptor)

    expect(storage.backend).toBe('localStorage')
  })

  it('exposes the caught error from write', () => {
    const quota = new DOMException('full', 'QuotaExceededError')
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw quota
    })
    const storage = createSafeStorage(['localStorage'])

    expect(storage.write('k', 'v')).toEqual({
      result: 'quota-exceeded',
      error: quota
    })
  })

  it('stays on localStorage when it is full, reporting failed writes', () => {
    localStorage.setItem('existing', 'data')
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    const storage = createSafeStorage(['localStorage', 'sessionStorage'])

    expect(storage.setItem('k', 'v')).toBe('quota-exceeded')
    expect(storage.backend).toBe('localStorage')
    expect(storage.getItem('existing')).toBe('data')
  })

  it('reports non-quota write errors as failed', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('nope', 'SecurityError')
    })
    const storage = createSafeStorage(['localStorage'])

    expect(storage.setItem('k', 'v')).toBe('failed')
  })

  it('never throws from reads, removals, or key listing', () => {
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('nope', 'SecurityError')
    })
    vi.spyOn(localStorage, 'removeItem').mockImplementation(() => {
      throw new DOMException('nope', 'SecurityError')
    })
    vi.spyOn(localStorage, 'key').mockImplementation(() => {
      throw new DOMException('nope', 'SecurityError')
    })
    localStorage.setItem('k', 'v')
    const storage = createSafeStorage(['localStorage'])

    expect(storage.getItem('k')).toBeNull()
    expect(() => storage.removeItem('k')).not.toThrow()
    expect(storage.keys()).toEqual([])
  })
})
