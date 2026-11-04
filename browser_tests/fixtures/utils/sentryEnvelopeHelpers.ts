import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import type { ErrorEvent } from '@sentry/vue'

import type { RemoteConfig } from '@/platform/remoteConfig/types'
import type { VueDirectiveRuntimeContext } from '@/platform/telemetry/vueDirectiveErrorDiagnostics'
import { VUE_DIRECTIVE_DIAGNOSTIC_TAG } from '@/platform/telemetry/vueDirectiveErrorDiagnostics'

const UNRESOLVABLE_SENTRY_DSN = 'https://fe3163e2e@example.invalid/1'
const ENVELOPE_URL = 'https://example.invalid/api/1/envelope/*'

export async function stubSentryDsnAndEnvelopes(page: Page): Promise<void> {
  await page.route('**/api/features', async (route) => {
    const response = await route.fetch()
    const body: unknown = await response.json()
    if (body === null || typeof body !== 'object') {
      throw new Error('The features response must be a non-null object')
    }
    await route.fulfill({
      response,
      json: {
        ...body,
        sentry_dsn: UNRESOLVABLE_SENTRY_DSN
      } satisfies RemoteConfig
    })
  })
  await page.route(ENVELOPE_URL, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: '{"id":"fe3163-e2e"}'
    })
  )
}

const CRASH_ENVELOPE_TIMEOUT_MS = 30_000

export function waitForCrashEnvelope(
  page: Page,
  marker: string
): Promise<string> {
  return page
    .waitForRequest(
      (request) =>
        request.url().includes('/api/1/envelope/') &&
        (request.postData() ?? '').includes(marker),
      { timeout: CRASH_ENVELOPE_TIMEOUT_MS }
    )
    .then((request) => request.postData() ?? '')
}

export async function injectThrowingDirectiveFrame(
  page: Page,
  message: string
): Promise<void> {
  await page.addScriptTag({
    content: `
      setTimeout(() => {
        function withDirectives() {
          throw new Error(${JSON.stringify(message)})
        }
        withDirectives()
      }, 0)
    `
  })
}

function isErrorEvent(payload: unknown): payload is ErrorEvent {
  return (
    typeof payload === 'object' && payload !== null && 'exception' in payload
  )
}

export function findErrorEvent(envelope: string): ErrorEvent {
  for (const line of envelope.split('\n')) {
    if (!line.startsWith('{')) continue
    const payload: unknown = JSON.parse(line)
    if (isErrorEvent(payload)) return payload
  }
  throw new Error(`No error event payload found in envelope:\n${envelope}`)
}

function isVueDirectiveRuntimeContext(
  context: unknown
): context is VueDirectiveRuntimeContext {
  if (typeof context !== 'object' || context === null) return false
  const candidate = context as Record<string, unknown>
  return (
    typeof candidate.frontend_version === 'string' &&
    typeof candidate.frontend_commit === 'string' &&
    typeof candidate.loaded_script_count === 'number' &&
    Array.isArray(candidate.first_party_script_paths) &&
    candidate.first_party_script_paths.every((path) => typeof path === 'string')
  )
}

export function expectVueDirectiveContext(event: ErrorEvent): void {
  expect(event.tags?.diagnostic).toBe(VUE_DIRECTIVE_DIAGNOSTIC_TAG)

  const context = event.contexts?.[VUE_DIRECTIVE_DIAGNOSTIC_TAG]
  expect(isVueDirectiveRuntimeContext(context)).toBe(true)
  if (!isVueDirectiveRuntimeContext(context)) return

  expect(context.frontend_version).toBeTruthy()
  expect(context.frontend_commit).toBeTruthy()
  expect(context.loaded_script_count).toBeGreaterThan(0)
  expect(context.first_party_script_paths).toHaveLength(
    context.loaded_script_count
  )
}
