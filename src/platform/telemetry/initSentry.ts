import type { App } from 'vue'
import {
  browserApiErrorsIntegration,
  eventFiltersIntegration,
  init as sentryInit
} from '@sentry/vue'
import type {
  Breadcrumb,
  Contexts,
  ErrorEvent,
  Event,
  EventHint,
  Exception
} from '@sentry/vue'

import { sentryBeforeSend } from './sentryBeforeSend'
import {
  REDACTION_SENTINEL,
  redactTelemetryUrls,
  redactTelemetryValues
} from './redactTelemetryUrls'

/** `@sentry/vue` re-exports neither `TransactionEvent` nor `SpanJSON`. */
type SentryOptions = NonNullable<Parameters<typeof sentryInit>[0]>
type SentryTransactionEvent = Parameters<
  NonNullable<SentryOptions['beforeSendTransaction']>
>[0]
type SentrySpan = Parameters<NonNullable<SentryOptions['beforeSendSpan']>>[0]
function redactSentryEvent(event: ErrorEvent, hint: EventHint) {
  const filtered = sentryBeforeSend(event, hint)
  if (!filtered) return null
  redactSharedSentryEventFields(filtered)
  for (const exception of filtered.exception?.values ?? []) {
    redactSentryException(exception)
  }
  return filtered
}

/**
 * `beforeSend` runs on error events only. A sampled transaction carries the
 * same page URL and referrer that `HttpContext` copies onto an error, so it
 * needs the shared pass of its own.
 */
function redactSentryTransaction(event: SentryTransactionEvent) {
  redactSharedSentryEventFields(event)
  return event
}

function redactSharedSentryEventFields(event: Event): void {
  if (event.message) {
    event.message = redactTelemetryUrls(event.message)
  }
  if (event.transaction) {
    event.transaction = redactTelemetryUrls(event.transaction)
  }
  if (event.tags) {
    event.tags = Object.fromEntries(
      Object.entries(event.tags).map(([key, value]) => [
        redactTelemetryUrls(key),
        typeof value === 'string' ? redactTelemetryUrls(value) : value
      ])
    )
  }
  event.extra = redactTelemetryValues(event.extra)
  event.contexts = redactSentryContexts(event.contexts)
  redactSentryRequest(event)
}

function redactSentryRequest(event: Event): void {
  const request = event.request
  if (!request) return
  if (request.url) request.url = redactTelemetryUrls(request.url)
  request.data = redactUnknownValue(request.data)
  request.query_string = redactSentryQueryString(request.query_string)
  const headers = request.headers ?? {}
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === 'referer') {
      headers[key] = redactTelemetryUrls(value)
    }
  }
}

type SentryQueryString = NonNullable<Event['request']>['query_string']

function redactSentryQueryString(query: SentryQueryString): SentryQueryString {
  if (typeof query === 'string') return query && REDACTION_SENTINEL
  if (Array.isArray(query)) {
    return query.map(([key, value]) => [
      redactTelemetryUrls(key),
      value && REDACTION_SENTINEL
    ])
  }
  if (!query) return query
  return Object.fromEntries(
    Object.entries(query).map(([key, value]) => [
      redactTelemetryUrls(key),
      value && REDACTION_SENTINEL
    ])
  )
}

function redactUnknownValue(value: unknown): unknown {
  return redactTelemetryValues({ value })?.value
}

function redactSentryContexts(contexts: Contexts | undefined): Contexts {
  return Object.fromEntries(
    Object.entries(contexts ?? {}).map(([key, context]) => [
      key,
      context ? redactTelemetryValues(context) : context
    ])
  )
}

function redactSentryBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  return {
    ...breadcrumb,
    message: breadcrumb.message
      ? redactTelemetryUrls(breadcrumb.message)
      : breadcrumb.message,
    data: redactTelemetryValues(breadcrumb.data)
  }
}

function redactSentrySpan(span: SentrySpan): SentrySpan {
  if (span.description) {
    span.description = redactTelemetryUrls(span.description)
  }
  redactSpanAttributes(span.data)
  for (const link of span.links ?? []) {
    if (link.attributes) redactSpanAttributes(link.attributes)
  }
  return span
}

function redactSpanAttributes(attributes: SentrySpan['data']): void {
  for (const [key, value] of Object.entries(attributes)) {
    if (typeof value === 'string') {
      attributes[key] = redactTelemetryUrls(value)
    } else if (Array.isArray(value)) {
      attributes[key] = value.map((item) =>
        typeof item === 'string' ? redactTelemetryUrls(item) : item
      ) as typeof value
    }
  }
}

function redactSentryException(exception: Exception): void {
  if (exception.type) exception.type = redactTelemetryUrls(exception.type)
  if (exception.value) exception.value = redactTelemetryUrls(exception.value)
  for (const frame of exception.stacktrace?.frames ?? []) {
    if (frame.filename) frame.filename = redactTelemetryUrls(frame.filename)
    if (frame.abs_path) frame.abs_path = redactTelemetryUrls(frame.abs_path)
  }
}

export function initSentry({
  app,
  dsn,
  enabled,
  isCloud
}: {
  app: App
  dsn: string
  enabled: boolean
  isCloud: boolean
}) {
  sentryInit({
    app,
    dsn,
    enabled,
    release: __COMFYUI_FRONTEND_VERSION__,
    normalizeDepth: 8,
    tracesSampleRate: isCloud ? 1.0 : 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    beforeSend: redactSentryEvent,
    beforeSendTransaction: redactSentryTransaction,
    beforeBreadcrumb: redactSentryBreadcrumb,
    beforeSendSpan: redactSentrySpan,
    denyUrls: [/^(?:chrome|moz|safari(?:-web)?|ms-browser)-extension:\/\//],
    // Only set these for non-cloud builds
    ...(isCloud
      ? {
          integrations: [
            // Disable event target wrapping to reduce overhead on high-frequency
            // DOM events (pointermove, mousemove, wheel). Sentry still captures
            // errors via window.onerror and unhandledrejection.
            browserApiErrorsIntegration({ eventTarget: false })
          ]
        }
      : {
          integrations: [eventFiltersIntegration()],
          autoSessionTracking: false,
          defaultIntegrations: false
        })
  })
}
