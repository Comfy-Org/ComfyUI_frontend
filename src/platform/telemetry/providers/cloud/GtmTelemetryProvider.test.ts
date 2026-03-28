import { beforeEach, describe, expect, it } from 'vitest'

import { GtmTelemetryProvider } from './GtmTelemetryProvider'

describe('GtmTelemetryProvider', () => {
  beforeEach(() => {
    window.__CONFIG__ = {}
    window.dataLayer = undefined
    window.gtag = undefined
    document.head.innerHTML = ''
  })

  it('injects the GTM runtime script', () => {
    window.__CONFIG__ = {
      gtm_container_id: 'GTM-TEST123'
    }

    new GtmTelemetryProvider()

    const gtmScript = document.querySelector(
      'script[src="https://www.googletagmanager.com/gtm.js?id=GTM-TEST123"]'
    )

    expect(gtmScript).not.toBeNull()
    expect(window.dataLayer?.[0]).toMatchObject({
      event: 'gtm.js'
    })
  })

  it('bootstraps gtag when a GA measurement id exists', () => {
    window.__CONFIG__ = {
      ga_measurement_id: 'G-TEST123'
    }

    new GtmTelemetryProvider()

    const gtagScript = document.querySelector(
      'script[src="https://www.googletagmanager.com/gtag/js?id=G-TEST123"]'
    )
    const dataLayer = window.dataLayer as unknown[]

    expect(gtagScript).not.toBeNull()
    expect(typeof window.gtag).toBe('function')
    expect(dataLayer).toHaveLength(2)
    expect(Array.from(dataLayer[0] as IArguments)[0]).toBe('js')
    expect(Array.from(dataLayer[1] as IArguments)).toEqual([
      'config',
      'G-TEST123',
      {
        send_page_view: false
      }
    ])
  })

  it('does not inject duplicate gtag scripts across repeated init', () => {
    window.__CONFIG__ = {
      ga_measurement_id: 'G-TEST123'
    }

    new GtmTelemetryProvider()
    new GtmTelemetryProvider()

    const gtagScripts = document.querySelectorAll(
      'script[src="https://www.googletagmanager.com/gtag/js?id=G-TEST123"]'
    )

    expect(gtagScripts).toHaveLength(1)
  })

  it('pushes subscription_success for subscription activation', () => {
    window.__CONFIG__ = {
      gtm_container_id: 'GTM-TEST123'
    }

    const provider = new GtmTelemetryProvider()
    provider.trackMonthlySubscriptionSucceeded()

    const lastEntry = window.dataLayer?.[window.dataLayer.length - 1]
    expect(lastEntry).toMatchObject({
      event: 'subscription_success'
    })
  })

  it('pushes normalized email as user_data before auth event', () => {
    window.__CONFIG__ = {
      gtm_container_id: 'GTM-TEST123'
    }

    const provider = new GtmTelemetryProvider()

    provider.trackAuth({
      method: 'email',
      is_new_user: true,
      user_id: 'uid-123',
      email: '  Test@Example.com  '
    })

    const dl = window.dataLayer as Record<string, unknown>[]
    const userData = dl.find((entry) => 'user_data' in entry)
    expect(userData).toMatchObject({
      user_data: { email: 'test@example.com' }
    })

    // Verify user_data is pushed before the sign_up event
    const userDataIndex = dl.findIndex((entry) => 'user_data' in entry)
    const signUpIndex = dl.findIndex(
      (entry) => (entry as Record<string, unknown>).event === 'sign_up'
    )
    expect(userDataIndex).toBeLessThan(signUpIndex)
  })

  it('does not push user_data when email is absent', () => {
    window.__CONFIG__ = {
      gtm_container_id: 'GTM-TEST123'
    }

    const provider = new GtmTelemetryProvider()

    provider.trackAuth({
      method: 'google',
      is_new_user: false,
      user_id: 'uid-456'
    })

    const dl = window.dataLayer as Record<string, unknown>[]
    const userData = dl.find((entry) => 'user_data' in entry)
    expect(userData).toBeUndefined()
  })
})
