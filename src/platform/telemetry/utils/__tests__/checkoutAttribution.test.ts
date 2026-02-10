import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getCheckoutAttribution } from '../checkoutAttribution'

const storage = new Map<string, string>()

const mockLocalStorage = vi.hoisted(() => ({
  getItem: vi.fn((key: string) => storage.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => {
    storage.set(key, value)
  }),
  removeItem: vi.fn((key: string) => {
    storage.delete(key)
  }),
  clear: vi.fn(() => {
    storage.clear()
  })
}))

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true
})

describe(getCheckoutAttribution, () => {
  beforeEach(() => {
    storage.clear()
    vi.clearAllMocks()
    window.__ga_identity__ = undefined
    window.history.pushState({}, '', '/')
  })

  it('reads GA identity and persists click ids from URL', () => {
    window.__ga_identity__ = {
      client_id: '123.456',
      session_id: '1700000000',
      session_number: '2'
    }
    window.history.pushState({}, '', '/?gclid=gclid-123')

    const attribution = getCheckoutAttribution()

    expect(attribution).toMatchObject({
      ga_client_id: '123.456',
      ga_session_id: '1700000000',
      ga_session_number: '2',
      gclid: 'gclid-123'
    })
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'comfy_checkout_attribution',
      JSON.stringify({ gclid: 'gclid-123' })
    )
  })

  it('uses stored click ids when URL is empty', () => {
    storage.set(
      'comfy_checkout_attribution',
      JSON.stringify({ gbraid: 'gbraid-1' })
    )

    const attribution = getCheckoutAttribution()

    expect(attribution.gbraid).toBe('gbraid-1')
  })
})
