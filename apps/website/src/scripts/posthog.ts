import posthog from 'posthog-js'
import { readonly, ref } from 'vue'
import type { Ref } from 'vue'

import { createPostHogBeforeSend } from '@comfyorg/shared-frontend-utils/piiUtil'

import type { Platform } from '@/composables/useDownloadUrl'
import type { ConnectionId, McpClientId } from '@/config/mcpClients'

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
  mcpClientTabClicked: 'website:mcp_client_tab_clicked'
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

let initialized = false

const WORKSHOP_AUTH_FLAG = 'workshop-auth'

/**
 * The build-time override forces the flag on for dev and preview builds, which
 * have no PostHog to answer; without it no flag-gated surface is exercisable
 * anywhere. It is sticky: an override-on build ignores PostHog turning the flag
 * off. Otherwise the ref tracks PostHog's answer both ways, so disabling the
 * flag remotely actually takes the surfaces down.
 */
const OVERRIDDEN_ON = import.meta.env.PUBLIC_WORKSHOP_AUTH_FLAG === '1'
const workshopAuthEnabled = ref(OVERRIDDEN_ON)

export function useWorkshopAuthFlag(): Readonly<Ref<boolean>> {
  return readonly(workshopAuthEnabled)
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
    posthog.onFeatureFlags(() => {
      if (OVERRIDDEN_ON) return
      workshopAuthEnabled.value =
        posthog.isFeatureEnabled(WORKSHOP_AUTH_FLAG) === true
    })
  } catch (error) {
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
