import posthog from 'posthog-js'

const POSTHOG_KEY = import.meta.env.PUBLIC_POSTHOG_KEY

let initialized = false

export function initPostHog(): void {
  if (typeof window === 'undefined' || initialized || !POSTHOG_KEY) return

  posthog.init(POSTHOG_KEY, {
    api_host: 'https://t.comfy.org',
    ui_host: 'https://us.posthog.com',
    person_profiles: 'always',
    cross_subdomain_cookie: true,
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: false,
    debug: import.meta.env.DEV
  })

  initialized = true
}

/**
 * All tracked events follow the object_verb taxonomy:
 * - snake_case
 * - past tense verbs
 * - e.g. hub:run_button_clicked, hub:template_viewed
 */
type EventProperties = Record<string, string | number | boolean | undefined>

export function capture(eventName: string, properties?: EventProperties): void {
  if (typeof window === 'undefined' || !initialized) return
  posthog.capture(eventName, properties)
}

// ─── Typed event helpers ───────────────────────────────────────────────

export function trackRunButtonClicked(
  templateName: string,
  location: string,
  author?: string
): void {
  capture('hub:run_button_clicked', {
    template_name: templateName,
    location,
    author
  })
}

export function trackDownloadButtonClicked(
  templateName: string,
  author?: string
): void {
  capture('hub:download_button_clicked', {
    template_name: templateName,
    author
  })
}

export function trackShareButtonClicked(
  templateName: string,
  author?: string
): void {
  capture('hub:share_button_clicked', {
    template_name: templateName,
    author
  })
}

export function trackTemplateViewed(
  templateName: string,
  mediaType: string,
  author?: string
): void {
  capture('hub:template_viewed', {
    template_name: templateName,
    media_type: mediaType,
    author
  })
}

export function trackSearchPerformed(query: string): void {
  capture('hub:search_performed', {
    query
  })
}

export function trackFilterApplied(
  filterType: string,
  filterValue: string
): void {
  capture('hub:filter_applied', {
    filter_type: filterType,
    filter_value: filterValue
  })
}

export function trackSignupCtaClicked(location: string): void {
  capture('hub:signup_cta_clicked', {
    location
  })
}
