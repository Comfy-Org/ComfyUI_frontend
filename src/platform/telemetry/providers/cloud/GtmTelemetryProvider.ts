import type {
  AuthMetadata,
  PageViewMetadata,
  TelemetryProvider
} from '../../types'

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[]
  }
}

/**
 * Google Tag Manager telemetry provider.
 * Pushes events to the GTM dataLayer for GA4 and marketing integrations.
 *
 * Only implements events relevant to GTM/GA4 tracking.
 * Other methods are no-ops (not implemented since interface is optional).
 */
export class GtmTelemetryProvider implements TelemetryProvider {
  private dataLayer: Record<string, unknown>[] = []
  private initialized = false

  constructor() {
    this.initialize()
  }

  private initialize(): void {
    if (typeof window === 'undefined') return

    const gtmId = window.__CONFIG__?.gtm_id
    if (!gtmId) {
      if (import.meta.env.MODE === 'development') {
        console.warn('[GTM] No GTM ID configured, skipping initialization')
      }
      return
    }

    window.dataLayer = window.dataLayer || []
    this.dataLayer = window.dataLayer

    this.dataLayer.push({
      'gtm.start': new Date().getTime(),
      event: 'gtm.js'
    })

    const script = document.createElement('script')
    script.async = true
    script.src = `https://www.googletagmanager.com/gtm.js?id=${gtmId}`
    document.head.insertBefore(script, document.head.firstChild)

    this.initialized = true
  }

  private pushEvent(event: string, properties?: Record<string, unknown>): void {
    if (!this.initialized) return
    this.dataLayer.push({ event, ...properties })
  }

  trackPageView(pageName: string, properties?: PageViewMetadata): void {
    this.pushEvent('page_view', {
      page_title: pageName,
      page_location: properties?.path,
      page_referrer: properties?.referrer
    })
  }

  trackAuth(metadata: AuthMetadata): void {
    if (metadata.is_new_user) {
      this.pushEvent('sign_up', {
        method: metadata.method
      })
    } else {
      this.pushEvent('login', {
        method: metadata.method
      })
    }
  }

  trackMonthlySubscriptionSucceeded(): void {
    this.pushEvent('purchase', {
      currency: 'USD',
      items: [{ item_name: 'Monthly Subscription' }]
    })
  }

  trackApiCreditTopupSucceeded(): void {
    this.pushEvent('purchase', {
      currency: 'USD',
      items: [{ item_name: 'API Credits' }]
    })
  }
}
