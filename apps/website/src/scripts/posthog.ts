import posthog from 'posthog-js'

import { createPostHogBeforeSend } from '@comfyorg/shared-frontend-utils/piiUtil'

import type { Platform } from '@/composables/useDownloadUrl'

const POSTHOG_KEY =
  import.meta.env.PUBLIC_POSTHOG_KEY ??
  'phc_iKfK86id4xVYws9LybMje0h44eGtfwFgRPIBehmy8rO'
const POSTHOG_API_HOST =
  import.meta.env.PUBLIC_POSTHOG_API_HOST ?? 'https://t.comfy.org'
const POSTHOG_UI_HOST =
  import.meta.env.PUBLIC_POSTHOG_UI_HOST ?? 'https://us.posthog.com'

let initialized = false

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
  } catch (error) {
    console.error('PostHog init failed', error)
  }
}

function safeCapture(event: string, properties?: Record<string, unknown>) {
  if (!initialized) return
  try {
    posthog.capture(event, properties)
  } catch (error) {
    console.error(`PostHog capture failed: ${event}`, error)
  }
}

export function capturePageview() {
  safeCapture('$pageview')
}

export function captureDownloadClick(platform: Platform) {
  safeCapture('website:download_button_clicked', { platform })
}

export function captureDownloadLinkRequested() {
  safeCapture('website:download_link_requested')
}

export function captureMcpClientTabClick(client: string) {
  safeCapture('website:mcp_client_tab_clicked', { client })
}
