import { captureCheckoutAttributionFromSearch } from '@/platform/telemetry/utils/checkoutAttribution'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'

import type { PageViewMetadata, TelemetryProvider } from '../../types'

const IMPACT_SCRIPT_URL =
  'https://utt.impactcdn.com/A6951770-3747-434a-9ac7-4e582e67d91f1.js'
const IMPACT_QUEUE_NAME = 'ire'
const EMPTY_CUSTOMER_VALUE = ''

/**
 * Impact telemetry provider.
 * Initializes the Impact queue globals and loads the runtime script.
 */
export class ImpactTelemetryProvider implements TelemetryProvider {
  private initialized = false

  constructor() {
    this.initialize()
  }

  trackPageView(_pageName: string, properties?: PageViewMetadata): void {
    const search = this.extractSearchFromPath(properties?.path)

    if (search) {
      captureCheckoutAttributionFromSearch(search)
    } else if (typeof window !== 'undefined') {
      captureCheckoutAttributionFromSearch(window.location.search)
    }

    void this.identifyCurrentUser()
  }

  private initialize(): void {
    if (typeof window === 'undefined' || this.initialized) return

    window.ire_o = IMPACT_QUEUE_NAME

    if (!window.ire) {
      const queueFn: NonNullable<Window['ire']> = (...args: unknown[]) => {
        ;(queueFn.a ??= []).push(args)
      }
      window.ire = queueFn
    }

    const existingScript = document.querySelector(
      `script[src="${IMPACT_SCRIPT_URL}"]`
    )
    if (existingScript) {
      this.initialized = true
      return
    }

    const script = document.createElement('script')
    script.async = true
    script.src = IMPACT_SCRIPT_URL

    const firstScript = document.getElementsByTagName('script')[0]
    if (firstScript?.parentNode) {
      firstScript.parentNode.insertBefore(script, firstScript)
    } else {
      document.head.append(script)
    }

    this.initialized = true
  }

  private extractSearchFromPath(path?: string): string {
    if (!path) return ''

    if (typeof window !== 'undefined') {
      try {
        const url = new URL(path, window.location.origin)
        return url.search
      } catch {
        // Fall through to manual parsing.
      }
    }

    const queryIndex = path.indexOf('?')
    return queryIndex >= 0 ? path.slice(queryIndex) : ''
  }

  private async identifyCurrentUser(): Promise<void> {
    if (typeof window === 'undefined') return

    const { customerId, customerEmail } = this.resolveCustomerIdentity()
    const normalizedEmail = customerEmail.trim().toLowerCase()
    // Impact's Identify spec requires customerEmail to be sent as a SHA1 hash.
    const hashedEmail = normalizedEmail
      ? await this.hashSha1(normalizedEmail)
      : EMPTY_CUSTOMER_VALUE

    window.ire?.('identify', {
      customerId,
      customerEmail: hashedEmail
    })
  }

  private resolveCustomerIdentity(): {
    customerId: string
    customerEmail: string
  } {
    try {
      const { resolvedUserInfo, userEmail } = useCurrentUser()

      return {
        customerId: resolvedUserInfo.value?.id ?? EMPTY_CUSTOMER_VALUE,
        customerEmail: userEmail.value ?? EMPTY_CUSTOMER_VALUE
      }
    } catch {
      return {
        customerId: EMPTY_CUSTOMER_VALUE,
        customerEmail: EMPTY_CUSTOMER_VALUE
      }
    }
  }

  private async hashSha1(value: string): Promise<string> {
    try {
      if (!globalThis.crypto?.subtle || typeof TextEncoder === 'undefined') {
        return EMPTY_CUSTOMER_VALUE
      }

      const digestBuffer = await crypto.subtle.digest(
        'SHA-1',
        new TextEncoder().encode(value)
      )

      return Array.from(new Uint8Array(digestBuffer))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('')
    } catch {
      return EMPTY_CUSTOMER_VALUE
    }
  }
}
