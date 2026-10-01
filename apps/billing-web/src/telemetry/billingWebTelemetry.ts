import type { WatchSource } from 'vue'

import type { CloudTelemetryConfig } from '@comfyorg/account-core/firebase'

import type { BillingWebSessionPhase } from '@/router'

export type BillingEventName = `billing.${string}.${string}`
export type BillingEventPayload = Readonly<Record<string, unknown>>

export type SessionIdentity =
  | { readonly kind: 'signed_in'; readonly userId: string }
  | { readonly kind: 'signed_out' }
  | { readonly kind: 'unknown' }

export interface StartPostHogOptions {
  readonly config: Promise<CloudTelemetryConfig>
  readonly identity: WatchSource<SessionIdentity>
}

export function toSessionIdentity(
  _phase: BillingWebSessionPhase | undefined,
  _userId: string | undefined
): SessionIdentity {
  return { kind: 'unknown' }
}

export function createBillingWebTelemetry() {
  return {
    startPostHog: async (_options: StartPostHogOptions): Promise<void> => {},
    trackBillingEvent: (
      _name: BillingEventName,
      _payload: BillingEventPayload
    ): void => {}
  }
}

export const billingWebTelemetry = createBillingWebTelemetry()
