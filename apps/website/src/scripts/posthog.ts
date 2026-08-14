import posthog from 'posthog-js'

import { createPostHogBeforeSend } from '@comfyorg/shared-frontend-utils/piiUtil'

import type { Platform } from '@/composables/useDownloadUrl'
import type { McpClientId } from '@/templates/mcp/clients'

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
  mcpClientTabClicked: 'website:mcp_client_tab_clicked'
} as const

type AnalyticsEvent =
  | { name: typeof ANALYTICS_EVENT.pageview; properties?: undefined }
  | {
      name: typeof ANALYTICS_EVENT.downloadButtonClicked
      properties: { platform: Platform }
    }
  | {
      name: typeof ANALYTICS_EVENT.mcpClientTabClicked
      properties: { client: McpClientId }
    }

let initialized = false

export function initPostHog(): void {
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

export function captureMcpClientTabClick(client: McpClientId): void {
  captureEvent({
    name: ANALYTICS_EVENT.mcpClientTabClicked,
    properties: { client }
  })
}
