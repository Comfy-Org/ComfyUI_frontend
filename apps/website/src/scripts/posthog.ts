import posthog from 'posthog-js'

import { createPostHogBeforeSend } from '@comfyorg/shared-frontend-utils/piiUtil'

import type { Locale } from '../i18n/translations'
import type { Platform } from '@/composables/useDownloadUrl'

const POSTHOG_KEY =
  import.meta.env.PUBLIC_POSTHOG_KEY ??
  'phc_iKfK86id4xVYws9LybMje0h44eGtfwFgRPIBehmy8rO'
const POSTHOG_API_HOST =
  import.meta.env.PUBLIC_POSTHOG_API_HOST ?? 'https://t.comfy.org'
const POSTHOG_UI_HOST =
  import.meta.env.PUBLIC_POSTHOG_UI_HOST ?? 'https://us.posthog.com'

let initialized = false
const capturesPendingInit: (() => void)[] = []

// A `client:load` island can mount before the BaseLayout script that calls
// initPostHog has executed, so mount-time captures have to be held rather
// than dropped or they are lost on every direct page load.
function captureWhenReady(description: string, send: () => void) {
  const guarded = () => {
    try {
      send()
    } catch (error) {
      console.error(`PostHog ${description} capture failed`, error)
    }
  }

  if (!initialized) {
    capturesPendingInit.push(guarded)
    return
  }

  guarded()
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
  } catch (error) {
    console.error('PostHog init failed', error)
    return
  }

  for (const send of capturesPendingInit.splice(0)) send()
}

export function capturePageview() {
  captureWhenReady('pageview', () => posthog.capture('$pageview'))
}

export function captureDownloadClick(platform: Platform) {
  captureWhenReady('download click', () =>
    posthog.capture('website:download_button_clicked', { platform })
  )
}

export function captureCliConnectionTabClick(connection: string) {
  captureWhenReady('CLI connection tab', () =>
    posthog.capture('website:cli_connection_tab_clicked', { connection })
  )
}

export function captureCliClientTabClick(client: string) {
  captureWhenReady('CLI client tab', () =>
    posthog.capture('website:cli_client_tab_clicked', { client })
  )
}

export function captureMcpConnectionTabClick(connection: string) {
  captureWhenReady('MCP connection tab', () =>
    posthog.capture('website:mcp_connection_tab_clicked', { connection })
  )
}

export function captureMcpClientTabClick(client: string) {
  captureWhenReady('MCP client tab', () =>
    posthog.capture('website:mcp_client_tab_clicked', { client })
  )
}

export function captureContactFormViewed(locale: Locale) {
  captureWhenReady('contact form viewed', () =>
    posthog.capture('website:contact_form_viewed', { locale })
  )
}

export function captureContactFormSubmitted(locale: Locale, formId: string) {
  captureWhenReady('contact form submitted', () =>
    posthog.capture('website:contact_form_submitted', {
      locale,
      form_id: formId
    })
  )
}
