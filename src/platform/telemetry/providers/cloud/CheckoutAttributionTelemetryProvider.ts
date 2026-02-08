import { captureCheckoutAttributionFromSearch } from '@/platform/telemetry/utils/checkoutAttribution'

import type { PageViewMetadata, TelemetryProvider } from '../../types'

/**
 * Internal cloud telemetry provider used to persist checkout attribution
 * from query parameters during page view tracking.
 */
export class CheckoutAttributionTelemetryProvider implements TelemetryProvider {
  trackPageView(_pageName: string, properties?: PageViewMetadata): void {
    const search = this.extractSearchFromPath(properties?.path)

    if (search) {
      captureCheckoutAttributionFromSearch(search)
      return
    }

    if (typeof window !== 'undefined') {
      captureCheckoutAttributionFromSearch(window.location.search)
    }
  }

  private extractSearchFromPath(path?: string): string {
    if (!path || typeof window === 'undefined') return ''

    try {
      const url = new URL(path, window.location.origin)
      return url.search
    } catch {
      const queryIndex = path.indexOf('?')
      return queryIndex >= 0 ? path.slice(queryIndex) : ''
    }
  }
}
