import type { PostHog } from 'posthog-js'
import { watch } from 'vue'
import type { WatchSource } from 'vue'

import type {
  BillingTelemetryEvent,
  BillingTelemetryEventName
} from '@comfyorg/account-core/billing'
import {
  getBillingTelemetryEventName,
  getBillingWebTelemetryEventPayload
} from '@comfyorg/account-core/billing'
import type { CloudTelemetryConfig } from '@comfyorg/account-core/firebase'
import {
  createPostHogBeforeSend,
  createPostHogUrlQueryScrub
} from '@comfyorg/shared-frontend-utils/piiUtil'
import {
  COMFY_POSTHOG_OPTIONS,
  DEFAULT_POSTHOG_API_HOST
} from '@comfyorg/shared-frontend-utils/telemetry'

import type { BillingWebSessionPhase } from '@/router'
import { addRumAction } from '@/telemetry/rum'

export type SessionIdentity =
  | { readonly kind: 'signed_in'; readonly userId: string }
  | { readonly kind: 'signed_out' }
  | { readonly kind: 'unknown' }

interface StartPostHogOptions {
  readonly config: Promise<CloudTelemetryConfig>
  readonly identity: WatchSource<SessionIdentity>
}

type PostHogClient = Pick<
  PostHog,
  'capture' | 'identify' | 'reset' | 'get_distinct_id' | 'get_property'
>

interface BillingEvent {
  readonly name: BillingTelemetryEventName
  readonly properties: Readonly<Record<string, unknown>>
}

type PostHogSink =
  | { readonly status: 'off' }
  | { readonly status: 'loading'; readonly waiting: BillingEvent[] }
  | {
      readonly status: 'ready'
      readonly client: PostHogClient
      readonly disabledEvents: ReadonlySet<string>
    }

/** Query parameters PostHog masks wherever it stores a URL, its cross-subdomain cookie included. */
const MASKED_URL_PARAMS = [
  'promo',
  'payment_intent',
  'payment_intent_client_secret',
  'setup_intent',
  'setup_intent_client_secret'
]

/** Bounds what waits on a PostHog load that never finishes. */
const MAX_WAITING_EVENTS = 50

/** Telemetry observes the billing flow; a failing sink must never break it. */
function attempt(send: () => void): void {
  try {
    send()
  } catch {
    return
  }
}

/** A refused or still-resolving session says nothing about who is signed in. */
export function toSessionIdentity(
  phase: BillingWebSessionPhase | undefined,
  userId: string | undefined
): SessionIdentity {
  if (phase === 'signed-out') return { kind: 'signed_out' }
  return userId === undefined
    ? { kind: 'unknown' }
    : { kind: 'signed_in', userId }
}

/** The identity lives in a cookie every *.comfy.org page shares, so it may already name someone. */
function identifyUser(client: PostHogClient, userId: string): void {
  if (client.get_distinct_id() === userId) return
  if (client.get_property('$user_state') === 'identified') client.reset(true)
  client.identify(userId)
}

/** Only a sign-out of the user identified here resets, so a visitor never signed in here keeps the Cloud identity. */
function syncIdentity(
  client: PostHogClient,
  identity: WatchSource<SessionIdentity>
): void {
  let identifiedHere = false
  watch(
    identity,
    (next) =>
      attempt(() => {
        if (next.kind === 'signed_in') {
          identifyUser(client, next.userId)
          identifiedHere = true
        } else if (next.kind === 'signed_out' && identifiedHere) {
          client.reset(true)
          identifiedHere = false
        }
      }),
    { immediate: true }
  )
}

async function loadPostHog(
  config: CloudTelemetryConfig
): Promise<PostHogClient | undefined> {
  if (!config.posthogProjectToken) return undefined
  const { default: posthog } = await import('posthog-js')
  posthog.init(config.posthogProjectToken, {
    api_host: config.posthogApiHost ?? DEFAULT_POSTHOG_API_HOST,
    ...COMFY_POSTHOG_OPTIONS,
    disable_session_recording: true,
    capture_performance: false,
    capture_heatmaps: false,
    capture_dead_clicks: false,
    capture_exceptions: false,
    disable_external_dependency_loading: true,
    mask_personal_data_properties: true,
    custom_personal_data_properties: MASKED_URL_PARAMS,
    before_send: [createPostHogBeforeSend(), createPostHogUrlQueryScrub()]
  })
  return posthog
}

export function createBillingWebTelemetry() {
  let posthog: PostHogSink = { status: 'off' }

  function capture(event: BillingEvent): void {
    switch (posthog.status) {
      case 'loading':
        if (posthog.waiting.length < MAX_WAITING_EVENTS)
          posthog.waiting.push(event)
        return
      case 'ready':
        if (!posthog.disabledEvents.has(event.name))
          posthog.client.capture(event.name, event.properties)
    }
  }

  /** Settles once PostHog is ready or known to be off; never rejects. */
  async function startPostHog({
    config,
    identity
  }: StartPostHogOptions): Promise<void> {
    const waiting: BillingEvent[] = []
    posthog = { status: 'loading', waiting }
    try {
      const resolved = await config
      const client = await loadPostHog(resolved)
      posthog = client
        ? {
            status: 'ready',
            client,
            disabledEvents: new Set(resolved.telemetryDisabledEvents)
          }
        : { status: 'off' }
      if (client) syncIdentity(client, identity)
    } catch {
      posthog = { status: 'off' }
    }
    for (const event of waiting) attempt(() => capture(event))
  }

  /**
   * One typed billing event to RUM and PostHog: the contract's allowlisted
   * payload, stamped with this surface.
   */
  function trackBillingEvent(event: BillingTelemetryEvent): void {
    attempt(() => {
      const name = getBillingTelemetryEventName(event)
      const properties = getBillingWebTelemetryEventPayload(event)
      attempt(() => addRumAction(name, properties))
      capture({ name, properties })
    })
  }

  return { startPostHog, trackBillingEvent }
}

export const billingWebTelemetry = createBillingWebTelemetry()
