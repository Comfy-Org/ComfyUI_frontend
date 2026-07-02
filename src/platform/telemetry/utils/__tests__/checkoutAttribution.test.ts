import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  captureCheckoutAttributionFromSearch,
  getCheckoutAttribution
} from '../checkoutAttribution'

describe('getCheckoutAttribution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    window.__CONFIG__ = {
      ...window.__CONFIG__,
      ga_measurement_id: undefined
    }
    window.gtag = undefined
    window.ire = undefined
    window.rewardful = undefined
    window.Rewardful = undefined
    window.history.pushState({}, '', '/')
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('reads GA identity and URL attribution, and prefers generated click id', async () => {
    window.__CONFIG__ = {
      ...window.__CONFIG__,
      ga_measurement_id: 'G-TEST123'
    }
    const gtagSpy = vi.fn(
      (
        _command: 'get',
        _targetId: string,
        fieldName: GtagGetFieldName,
        callback: (value: GtagGetFieldValueMap[GtagGetFieldName]) => void
      ) => {
        const valueByField = {
          client_id: '123.456',
          session_id: '1700000000',
          session_number: '2'
        }
        callback(valueByField[fieldName])
      }
    )
    window.gtag = gtagSpy as Partial<Window['gtag']> as Window['gtag']

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
      im_ref: 'generated-click-id'
    })
    expect(mockIreCall).toHaveBeenCalledWith(
      'generateClickId',
      expect.any(Function)
    )
    expect(gtagSpy).toHaveBeenCalledWith(
      'get',
      'G-TEST123',
      'client_id',
      expect.any(Function)
    )
    expect(gtagSpy).toHaveBeenCalledWith(
      'get',
      'G-TEST123',
      'session_id',
      expect.any(Function)
    )
    expect(gtagSpy).toHaveBeenCalledWith(
      'get',
      'G-TEST123',
      'session_number',
      expect.any(Function)
    )
  })

  it('stringifies numeric GA values from gtag', async () => {
    window.__CONFIG__ = {
      ...window.__CONFIG__,
      ga_measurement_id: 'G-TEST123'
    }
    const gtagSpy = vi.fn(
      (
        _command: 'get',
        _targetId: string,
        fieldName: GtagGetFieldName,
        callback: (value: GtagGetFieldValueMap[GtagGetFieldName]) => void
      ) => {
        const valueByField = {
          client_id: '123.456',
          session_id: 1700000000,
          session_number: 2
        }
        callback(valueByField[fieldName])
      }
    )
    window.gtag = gtagSpy as Partial<Window['gtag']> as Window['gtag']

    const attribution = await getCheckoutAttribution()

    expect(attribution).toMatchObject({
      ga_client_id: '123.456',
      ga_session_id: '1700000000',
      ga_session_number: '2'
    })
    expect(gtagSpy).toHaveBeenCalledWith(
      'get',
      'G-TEST123',
      'session_number',
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
      im_ref: 'fallback-from-url'
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
  })

  it('falls back to URL im_ref when generateClickId throws', async () => {
    window.history.pushState({}, '', '/?im_ref=url-fallback')
    window.ire = () => {
      throw new Error('Impact unavailable')
    }

    const attribution = await getCheckoutAttribution()

    expect(attribution.im_ref).toBe('url-fallback')
  })

  it('persists click and UTM attribution across navigation', async () => {
    window.history.pushState(
      {},
      '',
      '/?gclid=gclid-123&utm_source=impact&utm_campaign=spring-launch'
    )

    await getCheckoutAttribution()
    window.history.pushState({}, '', '/pricing')

    const attribution = await getCheckoutAttribution()

    expect(attribution).toMatchObject({
      gclid: 'gclid-123',
      utm_source: 'impact',
      utm_campaign: 'spring-launch'
    })
  })

  it('stores attribution from page-view capture for later checkout', async () => {
    captureCheckoutAttributionFromSearch(
      '?gbraid=gbraid-123&utm_medium=affiliate'
    )
    window.history.pushState({}, '', '/pricing')

    const attribution = await getCheckoutAttribution()

    expect(attribution).toMatchObject({
      gbraid: 'gbraid-123',
      utm_medium: 'affiliate'
    })
  })

  it('stores click id from page-view capture for later checkout', async () => {
    captureCheckoutAttributionFromSearch('?im_ref=impact-123')
    window.history.pushState({}, '', '/pricing')

    const attribution = await getCheckoutAttribution()

    expect(attribution).toMatchObject({
      im_ref: 'impact-123'
    })
  })

  it('does not rewrite click id when page-view capture value is unchanged', () => {
    window.localStorage.setItem(
      'comfy_checkout_attribution',
      JSON.stringify({
        im_ref: 'impact-123'
      })
    )
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')

    captureCheckoutAttributionFromSearch('?im_ref=impact-123')

    expect(setItemSpy).not.toHaveBeenCalled()
  })

  it('ignores impact_click_id query param', async () => {
    window.history.pushState({}, '', '/?impact_click_id=impact-query-id')

    const attribution = await getCheckoutAttribution()

    expect(attribution.im_ref).toBeUndefined()
  })

  it('captures Rewardful referral from window.Rewardful', async () => {
    window.Rewardful = {
      referral: 'rwd-abc-123'
    }

    const attribution = await getCheckoutAttribution()

    expect(attribution.rewardful_referral).toBe('rwd-abc-123')
  })

  it('returns undefined Rewardful referral when window.Rewardful is absent', async () => {
    const attribution = await getCheckoutAttribution()

    expect(attribution.rewardful_referral).toBeUndefined()
  })

  it('waits for Rewardful ready before reading the referral', async () => {
    let readyCallback: (() => void) | undefined
    window.rewardful = vi.fn((_method: 'ready', callback: () => void) => {
      readyCallback = callback
    }) as Window['rewardful']

    const attributionPromise = getCheckoutAttribution()
    await Promise.resolve()

    expect(window.rewardful).toHaveBeenCalledWith('ready', expect.any(Function))

    window.Rewardful = {
      referral: 'rwd-ready-123'
    }
    readyCallback?.()

    const attribution = await attributionPromise

    expect(attribution.rewardful_referral).toBe('rwd-ready-123')
  })

  it('continues checkout attribution when Rewardful ready never runs', async () => {
    vi.useFakeTimers()
    window.rewardful = vi.fn() as Window['rewardful']

    const attributionPromise = getCheckoutAttribution()
    await vi.advanceTimersByTimeAsync(300)
    const attribution = await attributionPromise

    expect(window.rewardful).toHaveBeenCalledWith('ready', expect.any(Function))
    expect(attribution.rewardful_referral).toBeUndefined()
  })

  it('returns undefined Rewardful referral when window.Rewardful.referral is empty', async () => {
    window.Rewardful = { referral: '' }

    const attribution = await getCheckoutAttribution()

    expect(attribution.rewardful_referral).toBeUndefined()
  })

  it('captures Rewardful referral alongside Impact attribution', async () => {
    window.history.pushState(
      {},
      '',
      '/?im_ref=impact-url-id&utm_source=affiliate'
    )
    window.Rewardful = {
      referral: 'rwd-xyz-789'
    }

    const attribution = await getCheckoutAttribution()

    expect(attribution).toMatchObject({
      im_ref: 'impact-url-id',
      utm_source: 'affiliate',
      rewardful_referral: 'rwd-xyz-789'
    })
  })
})
