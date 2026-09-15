import { WORKSHOP_LOCAL_DEV, WORKSHOP_DEPLOY_ENV } from 'astro:env/client'
import { posthog } from 'posthog-js'
import { readonly, ref } from 'vue'
import type { Ref } from 'vue'

import type { SessionRefreshOutcome } from '@comfyorg/account/session'
import {
  AUTH_TELEMETRY_EVENT,
  SESSION_TELEMETRY_EVENT
} from '@comfyorg/account/telemetry'
import type {
  AuthCompletedMetadata,
  AuthErrorMetadata
} from '@comfyorg/account/telemetry'
import { createPostHogBeforeSend } from '@comfyorg/shared-frontend-utils/piiUtil'
import { normalizeTurnstileMode } from '@comfyorg/account/turnstile'
import type { TurnstileMode } from '@comfyorg/account/turnstile'

import type { Platform } from '@/composables/useDownloadUrl'
import type { ConnectionId, McpClientId } from '@/config/mcpClients'
import type { WorkshopAnalyticsEvent } from './workshop-analytics'

const POSTHOG_KEY =
  import.meta.env.PUBLIC_POSTHOG_KEY ??
  'phc_iKfK86id4xVYws9LybMje0h44eGtfwFgRPIBehmy8rO'
const POSTHOG_API_HOST =
  import.meta.env.PUBLIC_POSTHOG_API_HOST ?? 'https://t.comfy.org'
const POSTHOG_UI_HOST =
  import.meta.env.PUBLIC_POSTHOG_UI_HOST ?? 'https://us.posthog.com'

const ANALYTICS_EVENT = {
  pageview: '$pageview',
  downloadButtonClicked: 'website:download_button_clicked',
  cliConnectionTabClicked: 'website:cli_connection_tab_clicked',
  cliClientTabClicked: 'website:cli_client_tab_clicked',
  mcpConnectionTabClicked: 'website:mcp_connection_tab_clicked',
  mcpClientTabClicked: 'website:mcp_client_tab_clicked',
  // Shared with the cloud app so one PostHog funnel covers auth outcomes
  // across every surface.
  authRefreshSucceeded: SESSION_TELEMETRY_EVENT.refreshSucceeded,
  authRefreshFailed: SESSION_TELEMETRY_EVENT.refreshFailed,
  signUpOpened: AUTH_TELEMETRY_EVENT.signUpOpened,
  authCompleted: AUTH_TELEMETRY_EVENT.authCompleted,
  authFailed: AUTH_TELEMETRY_EVENT.authFailed,
  workshopSignupRollbackFailed: 'website:workshop_signup_rollback_failed'
} as const

export type CliClientId =
  | 'claude-code'
  | 'codex'
  | 'cursor'
  | 'gemini-cli'
  | 'openclaw'
  | 'hermes'
  | 'terminal'
  | 'ci'

type AnalyticsEvent =
  | {
      name: `website:workshop_${WorkshopAnalyticsEvent['name']}`
      properties: WorkshopAnalyticsEvent['properties']
    }
  | { name: typeof ANALYTICS_EVENT.pageview; properties?: undefined }
  | {
      name: typeof ANALYTICS_EVENT.downloadButtonClicked
      properties: { platform: Platform }
    }
  | {
      name:
        | typeof ANALYTICS_EVENT.cliConnectionTabClicked
        | typeof ANALYTICS_EVENT.mcpConnectionTabClicked
      properties: { connection: ConnectionId }
    }
  | {
      name: typeof ANALYTICS_EVENT.cliClientTabClicked
      properties: { client: CliClientId }
    }
  | {
      name: typeof ANALYTICS_EVENT.mcpClientTabClicked
      properties: { client: McpClientId }
    }
  | {
      name:
        | typeof ANALYTICS_EVENT.authRefreshSucceeded
        | typeof ANALYTICS_EVENT.authRefreshFailed
      properties: { outcome: SessionRefreshOutcome }
    }
  | {
      name: typeof ANALYTICS_EVENT.workshopSignupRollbackFailed
      properties?: undefined
    }
  | { name: typeof ANALYTICS_EVENT.signUpOpened; properties?: undefined }
  | {
      name: typeof ANALYTICS_EVENT.authCompleted
      properties: AuthCompletedMetadata
    }
  | {
      name: typeof ANALYTICS_EVENT.authFailed
      properties: AuthErrorMetadata
    }

let initialized = false

const WORKSHOP_AUTH_FLAG = 'workshop-auth'
const WORKSHOP_ENABLED_FLAG = 'workshop-enabled'
const WORKSHOP_TURNSTILE_FLAG = 'workshop-signup-turnstile'

const VISIBILITY_OVERRIDE =
  WORKSHOP_LOCAL_DEV && import.meta.env.PUBLIC_WORKSHOP_ENABLED === '1'
const workshopEnabled = ref(VISIBILITY_OVERRIDE)
const workshopEnabledSettled = ref(true)
let workshopUser: WorkshopIdentity | null | undefined

export function useWorkshopEnabled(): Readonly<Ref<boolean>> {
  return readonly(workshopEnabled)
}

export function useWorkshopEnabledSettled(): Readonly<Ref<boolean>> {
  return readonly(workshopEnabledSettled)
}

export interface WorkshopIdentity {
  uid: string
  email?: string | null
  emailVerified?: boolean
}

const STAFF_EMAIL_DOMAINS = new Set(['comfy.org', 'drip.art'])

function isStaff({ email, emailVerified }: WorkshopIdentity): boolean {
  const domain = email?.split('@')[1]?.toLowerCase()
  return (
    emailVerified === true &&
    domain !== undefined &&
    STAFF_EMAIL_DOMAINS.has(domain)
  )
}

function identifyInPostHog(user: WorkshopIdentity): void {
  if (isStaff(user)) posthog.identify(user.uid, { comfy_staff: true })
  else posthog.identify(user.uid)
}

export function identifyWorkshopUser(user: WorkshopIdentity | null): void {
  if (workshopUser !== undefined && workshopUser?.uid === user?.uid) return
  const previous = workshopUser
  workshopUser = user
  const waitForIdentityAnswer = !VISIBILITY_OVERRIDE && user !== null
  if (!initialized) {
    workshopEnabledSettled.value = !waitForIdentityAnswer
    return
  }
  try {
    const uid = user?.uid ?? null
    const persistedUid = posthog.get_property('$user_id') ?? previous?.uid
    if (uid === persistedUid || (!uid && !persistedUid)) {
      if (
        user &&
        posthog.isFeatureEnabled(WORKSHOP_ENABLED_FLAG, {
          send_event: false
        }) === undefined
      ) {
        workshopEnabledSettled.value = false
        posthog.reloadFeatureFlags()
      }
      return
    }
    workshopEnabled.value = VISIBILITY_OVERRIDE
    workshopEnabledSettled.value = !waitForIdentityAnswer
    if (persistedUid) posthog.reset()
    if (user) identifyInPostHog(user)
    posthog.reloadFeatureFlags()
  } catch (error) {
    workshopUser = previous
    workshopEnabled.value = VISIBILITY_OVERRIDE
    workshopEnabledSettled.value = true
    console.error('PostHog identity failed', error)
  }
}

const OVERRIDDEN_ON =
  WORKSHOP_DEPLOY_ENV !== 'production' &&
  import.meta.env.PUBLIC_WORKSHOP_AUTH_FLAG === '1'
const workshopAuthEnabled = ref(true)
const TURNSTILE_OVERRIDE = import.meta.env.PUBLIC_WORKSHOP_TURNSTILE_MODE
const TURNSTILE_OVERRIDDEN = Boolean(TURNSTILE_OVERRIDE)
const workshopTurnstileMode = ref<TurnstileMode>(
  normalizeTurnstileMode(TURNSTILE_OVERRIDE)
)

export function useWorkshopAuthFlag(): Readonly<Ref<boolean>> {
  return readonly(workshopAuthEnabled)
}

export function useWorkshopTurnstileMode(): Readonly<Ref<TurnstileMode>> {
  return readonly(workshopTurnstileMode)
}

export function initPostHog() {
  if (initialized || typeof window === 'undefined' || !POSTHOG_KEY) return
  try {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_API_HOST,
      ui_host: POSTHOG_UI_HOST,
      capture_pageview: false,
      capture_pageleave: true,
      person_profiles: 'identified_only',
      // cookie_domain omitted — see PostHogTelemetryProvider.ts note + posthog-js#3578
      before_send: createPostHogBeforeSend()
    })
    initialized = true
    const persistedAnswer = posthog.isFeatureEnabled(WORKSHOP_ENABLED_FLAG, {
      send_event: false
    })
    const persistedUid = posthog.get_property('$user_id')
    const expectedUid = workshopUser?.uid ?? null
    const persistedIdentityMatches =
      workshopUser === undefined ||
      expectedUid === persistedUid ||
      (!expectedUid && !persistedUid)
    if (persistedAnswer !== undefined && persistedIdentityMatches) {
      workshopEnabled.value = VISIBILITY_OVERRIDE || persistedAnswer
      workshopEnabledSettled.value = true
    }
    posthog.onFeatureFlags((_flags, _variants, context) => {
      if (context?.errorsLoading) {
        workshopEnabledSettled.value = true
        return
      }
      workshopEnabled.value =
        VISIBILITY_OVERRIDE ||
        posthog.isFeatureEnabled(WORKSHOP_ENABLED_FLAG) === true
      workshopEnabledSettled.value = true
      if (!OVERRIDDEN_ON) {
        workshopAuthEnabled.value =
          posthog.isFeatureEnabled(WORKSHOP_AUTH_FLAG) !== false
      }
      if (!TURNSTILE_OVERRIDDEN) {
        const value = posthog.getFeatureFlag(WORKSHOP_TURNSTILE_FLAG)
        workshopTurnstileMode.value = normalizeTurnstileMode(
          typeof value === 'string' ? value : undefined
        )
      }
    })
    if (workshopUser !== undefined) {
      const user = workshopUser
      workshopUser = undefined
      identifyWorkshopUser(user)
    }
  } catch (error) {
    workshopEnabledSettled.value = true
    console.error('PostHog init failed', error)
  }
}

function captureEvent(event: AnalyticsEvent): void {
  if (!initialized) return
  try {
    posthog.capture(event.name, event.properties)
  } catch (error) {
    console.error(`PostHog capture failed for ${event.name}`, error)
  }
}

export function capturePageview(): void {
  captureEvent({ name: ANALYTICS_EVENT.pageview })
}

export function captureWorkshopEvent(event: WorkshopAnalyticsEvent): void {
  captureEvent({
    name: `website:workshop_${event.name}`,
    properties: event.properties
  })
}

export function captureDownloadClick(platform: Platform): void {
  captureEvent({
    name: ANALYTICS_EVENT.downloadButtonClicked,
    properties: { platform }
  })
}

export function captureCliConnectionTabClick(connection: ConnectionId): void {
  captureEvent({
    name: ANALYTICS_EVENT.cliConnectionTabClicked,
    properties: { connection }
  })
}

export function captureCliClientTabClick(client: CliClientId): void {
  captureEvent({
    name: ANALYTICS_EVENT.cliClientTabClicked,
    properties: { client }
  })
}

export function captureMcpConnectionTabClick(connection: ConnectionId): void {
  captureEvent({
    name: ANALYTICS_EVENT.mcpConnectionTabClicked,
    properties: { connection }
  })
}

export function captureMcpClientTabClick(client: McpClientId): void {
  captureEvent({
    name: ANALYTICS_EVENT.mcpClientTabClicked,
    properties: { client }
  })
}

export function captureAuthRefreshSucceeded(): void {
  captureEvent({
    name: ANALYTICS_EVENT.authRefreshSucceeded,
    properties: { outcome: 'succeeded' }
  })
}

/**
 * Fired when a failed sign-up could not roll back its just-created Firebase
 * user even after the retried delete: the account is orphaned and every
 * later sign-up with that email fails. No error payload on purpose; the
 * event is the count, and error content risks carrying PII.
 */
export function captureSignupRollbackFailure(): void {
  captureEvent({ name: ANALYTICS_EVENT.workshopSignupRollbackFailed })
}

export function captureAuthRefreshFailed(outcome: SessionRefreshOutcome): void {
  captureEvent({
    name: ANALYTICS_EVENT.authRefreshFailed,
    properties: { outcome }
  })
}

export function captureSignupOpened(): void {
  captureEvent({ name: ANALYTICS_EVENT.signUpOpened })
}

export function captureAuthCompleted(metadata: AuthCompletedMetadata): void {
  captureEvent({ name: ANALYTICS_EVENT.authCompleted, properties: metadata })
}

export function captureAuthFailed(metadata: AuthErrorMetadata): void {
  captureEvent({ name: ANALYTICS_EVENT.authFailed, properties: metadata })
}
