// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  readStoredCredentials,
  writeStoredCredentials
} from './workshop-credentials'

afterEach(() => {
  globalThis.localStorage.clear()
})

describe('workshop credentials', () => {
  it('round-trips a key', () => {
    writeStoredCredentials('comfyui-abc')
    expect(readStoredCredentials()).toBe('comfyui-abc')
  })

  it('reads empty when nothing is stored', () => {
    expect(readStoredCredentials()).toBe('')
  })

  it('clears the key rather than storing an empty one', () => {
    writeStoredCredentials('comfyui-abc')
    writeStoredCredentials('')

    expect(readStoredCredentials()).toBe('')
    expect(globalThis.localStorage.getItem('comfy.workshop.apiKey')).toBeNull()
  })

  it('keeps working when storage itself throws', () => {
    // Safari in private browsing, and any origin with cookies blocked, throw
    // on access rather than returning null. A run does not need the key to
    // persist, so this must not take the page down with it.
    vi.spyOn(globalThis.localStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    vi.spyOn(globalThis.localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })

    expect(() => writeStoredCredentials('comfyui-abc')).not.toThrow()
    expect(readStoredCredentials()).toBe('')
  })
})
