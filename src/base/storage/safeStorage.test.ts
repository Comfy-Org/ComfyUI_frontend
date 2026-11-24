import { describe, expect, it, vi } from 'vitest'

import { SafeStorage } from './safeStorage'

type StorageGlobal = 'localStorage' | 'sessionStorage'

function denyAccess(name: StorageGlobal) {
  return vi.spyOn(window, name, 'get').mockImplementation(() => {
    throw new DOMException('Access is denied', 'SecurityError')
  })
}

describe('SafeStorage', () => {
  it('uses localStorage when it is readable', () => {
    const storage = new SafeStorage(['localStorage', 'sessionStorage'])

    expect(storage.setItem('k', 'v')).toBe('ok')
    expect(storage.backend).toBe('localStorage')
    expect(storage.isPersistent).toBe(true)
    expect(localStorage.getItem('k')).toBe('v')
    expect(storage.asStorage()).toBe(localStorage)
    expect(storage.isStorageArea(localStorage)).toBe(true)
    expect(storage.isStorageArea(sessionStorage)).toBe(false)
  })

  it('fails over to sessionStorage when reading localStorage throws', () => {
    denyAccess('localStorage')
    const storage = new SafeStorage(['localStorage', 'sessionStorage'])

    expect(storage.setItem('k', 'v')).toBe('ok')
    expect(storage.backend).toBe('sessionStorage')
    expect(sessionStorage.getItem('k')).toBe('v')
  })

  it('fails over to memory when every native backend is denied', () => {
    denyAccess('localStorage')
    denyAccess('sessionStorage')
    const storage = new SafeStorage(['localStorage', 'sessionStorage'])

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
    const storage = new SafeStorage(['localStorage'])
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
    const storage = new SafeStorage(['localStorage', 'sessionStorage'])
    expect(storage.backend).toBe('localStorage')

    denyAccess('localStorage')

    expect(storage.setItem('k', 'v')).toBe('ok')
    expect(storage.backend).toBe('sessionStorage')
    expect(sessionStorage.getItem('k')).toBe('v')
  })

  it('keeps the fallback once access is restored so fallback writes stay visible', () => {
    const storage = new SafeStorage(['localStorage', 'sessionStorage'])
    expect(storage.backend).toBe('localStorage')
    const denied = denyAccess('localStorage')
    expect(storage.setItem('k', 'fallback')).toBe('ok')

    denied.mockRestore()

    expect(storage.backend).toBe('sessionStorage')
    expect(storage.getItem('k')).toBe('fallback')
  })

  it('exposes the caught error from write', () => {
    const quota = new DOMException('full', 'QuotaExceededError')
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw quota
    })
    const storage = new SafeStorage(['localStorage'])

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
    const storage = new SafeStorage(['localStorage', 'sessionStorage'])

    expect(storage.setItem('k', 'v')).toBe('quota-exceeded')
    expect(storage.backend).toBe('localStorage')
    expect(storage.getItem('existing')).toBe('data')
  })

  it('reports non-quota write errors as failed', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('nope', 'SecurityError')
    })
    const storage = new SafeStorage(['localStorage'])

    expect(storage.setItem('k', 'v')).toBe('failed')
  })

  it('never throws when native operations fail after the backend is chosen', () => {
    localStorage.setItem('k', 'v')
    const storage = new SafeStorage(['localStorage'])
    expect(storage.backend).toBe('localStorage')
    const denied = new DOMException('nope', 'SecurityError')
    const fail = () => {
      throw denied
    }
    vi.spyOn(localStorage, 'getItem').mockImplementation(fail)
    vi.spyOn(localStorage, 'removeItem').mockImplementation(fail)
    vi.spyOn(localStorage, 'key').mockImplementation(fail)

    expect(storage.getItem('k')).toBeNull()
    expect(storage.read('k')).toEqual({ ok: false, error: denied })
    expect(() => storage.removeItem('k')).not.toThrow()
    expect(storage.remove('k')).toEqual({ ok: false, error: denied })
    expect(storage.keys()).toEqual([])
    expect(storage.backend).toBe('localStorage')
  })

  it('reports a successful removal', () => {
    localStorage.setItem('k', 'v')
    const storage = new SafeStorage(['localStorage'])

    expect(storage.remove('k')).toEqual({ ok: true })
    expect(localStorage.getItem('k')).toBeNull()
  })

  it('reads a missing key as a successful null', () => {
    const storage = new SafeStorage(['localStorage'])

    expect(storage.read('missing')).toEqual({ ok: true, value: null })
  })
})
