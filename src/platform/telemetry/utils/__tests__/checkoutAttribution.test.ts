import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getCheckoutAttribution } from '../checkoutAttribution'

describe('getCheckoutAttribution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.__ga_identity__ = undefined
    window.ire = undefined
    window.history.pushState({}, '', '/')
  })

  it('reads GA identity and URL attribution, and prefers generated click id', async () => {
    window.__ga_identity__ = {
      client_id: '123.456',
      session_id: '1700000000',
      session_number: '2'
    }
    window.history.pushState(
      {},
      '',
      '/?gclid=gclid-123&utm_source=impact&im_ref=url-click-id'
    )
    const mockIreCall = vi.fn()
    window.ire = (...args: unknown[]) => {
      mockIreCall(...args)
      const callback = args[1]
      if (typeof callback === 'function') {
        ;(callback as (value: string) => void)('generated-click-id')
      }
    }

    const attribution = await getCheckoutAttribution()

    expect(attribution).toMatchObject({
      ga_client_id: '123.456',
      ga_session_id: '1700000000',
      ga_session_number: '2',
      gclid: 'gclid-123',
      utm_source: 'impact',
      im_ref: 'generated-click-id',
      impact_click_id: 'generated-click-id'
    })
    expect(mockIreCall).toHaveBeenCalledWith(
      'generateClickId',
      expect.any(Function)
    )
  })

  it('falls back to URL click id when generateClickId is unavailable', async () => {
    window.history.pushState(
      {},
      '',
      '/?utm_campaign=launch&im_ref=fallback-from-url'
    )

    const attribution = await getCheckoutAttribution()

    expect(attribution).toMatchObject({
      utm_campaign: 'launch',
      im_ref: 'fallback-from-url',
      impact_click_id: 'fallback-from-url'
    })
  })

  it('returns URL attribution only when no click id is available', async () => {
    window.history.pushState({}, '', '/?utm_source=impact&utm_medium=affiliate')

    const attribution = await getCheckoutAttribution()

    expect(attribution).toMatchObject({
      utm_source: 'impact',
      utm_medium: 'affiliate'
    })
    expect(attribution.im_ref).toBeUndefined()
    expect(attribution.impact_click_id).toBeUndefined()
  })

  it('falls back to URL im_ref when generateClickId throws', async () => {
    window.history.pushState({}, '', '/?im_ref=url-fallback')
    window.ire = () => {
      throw new Error('Impact unavailable')
    }

    const attribution = await getCheckoutAttribution()

    expect(attribution.im_ref).toBe('url-fallback')
    expect(attribution.impact_click_id).toBe('url-fallback')
  })
})
