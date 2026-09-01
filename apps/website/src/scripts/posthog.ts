import posthog from 'posthog-js'

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
      person_profiles: 'identified_only'
    })
    initialized = true
  } catch (error) {
    console.error('PostHog init failed', error)
  }
}

export function capturePageview() {
  if (!initialized) return
  try {
    posthog.capture('$pageview')
  } catch (error) {
    console.error('PostHog pageview capture failed', error)
  }
}
