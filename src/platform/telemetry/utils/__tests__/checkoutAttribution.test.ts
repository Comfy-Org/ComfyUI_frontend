import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  captureCheckoutAttributionFromSearch,
  getCheckoutAttribution
} from '../checkoutAttribution'

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

describe('getCheckoutAttribution', () => {
  beforeEach(() => {
    storage.clear()
    vi.clearAllMocks()
    window.__ga_identity__ = undefined
    window.history.pushState({}, '', '/')
  })

  it('reads GA identity and persists attribution from URL', () => {
    window.__ga_identity__ = {
      client_id: '123.456',
      session_id: '1700000000',
      session_number: '2'
    }
    window.history.pushState(
      {},
      '',
      '/?gclid=gclid-123&utm_source=impact&im_ref=impact-123'
    )

    const attribution = getCheckoutAttribution()

    expect(attribution).toMatchObject({
      ga_client_id: '123.456',
      ga_session_id: '1700000000',
      ga_session_number: '2',
      gclid: 'gclid-123',
      utm_source: 'impact',
      im_ref: 'impact-123',
      impact_click_id: 'impact-123'
    })
    expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(1)
    const firstPersistedPayload = mockLocalStorage.setItem.mock.calls[0]?.[1]
    expect(JSON.parse(firstPersistedPayload)).toEqual({
      gclid: 'gclid-123',
      utm_source: 'impact',
      im_ref: 'impact-123'
    })
  })

  it('uses stored attribution when URL is empty', () => {
    storage.set(
      'comfy_checkout_attribution',
      JSON.stringify({ gbraid: 'gbraid-1', im_ref: 'impact-abc' })
    )

    const attribution = getCheckoutAttribution()

    expect(attribution.gbraid).toBe('gbraid-1')
    expect(attribution.im_ref).toBe('impact-abc')
    expect(attribution.impact_click_id).toBe('impact-abc')
  })

  it('captures attribution from current URL search string', () => {
    window.history.pushState({}, '', '/?utm_campaign=launch&im_ref=impact-456')

    captureCheckoutAttributionFromSearch(window.location.search)

    expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(1)
    const capturedPayload = mockLocalStorage.setItem.mock.calls[0]?.[1]
    expect(JSON.parse(capturedPayload)).toEqual({
      utm_campaign: 'launch',
      im_ref: 'impact-456'
    })
  })

  it('captures attribution from an explicit search string', () => {
    captureCheckoutAttributionFromSearch(
      '?utm_source=impact&utm_medium=affiliate&im_ref=impact-789'
    )

    expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(1)
    const capturedPayload = mockLocalStorage.setItem.mock.calls[0]?.[1]
    expect(JSON.parse(capturedPayload)).toEqual({
      utm_source: 'impact',
      utm_medium: 'affiliate',
      im_ref: 'impact-789'
    })
  })

  it('does not persist when explicit search attribution matches stored values', () => {
    storage.set(
      'comfy_checkout_attribution',
      JSON.stringify({ utm_source: 'impact', im_ref: 'impact-789' })
    )

    captureCheckoutAttributionFromSearch('?utm_source=impact&im_ref=impact-789')

    expect(mockLocalStorage.setItem).not.toHaveBeenCalled()
  })

  it('does not persist from URL when query attribution matches stored values', () => {
    storage.set(
      'comfy_checkout_attribution',
      JSON.stringify({ gclid: 'gclid-123', im_ref: 'impact-abc' })
    )
    window.history.pushState({}, '', '/?gclid=gclid-123&im_ref=impact-abc')

    const attribution = getCheckoutAttribution()

    expect(attribution).toMatchObject({
      gclid: 'gclid-123',
      im_ref: 'impact-abc',
      impact_click_id: 'impact-abc'
    })
    expect(mockLocalStorage.setItem).not.toHaveBeenCalled()
  })
})
