import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import type { RemoteConfig } from '@/platform/remoteConfig/types'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'

const FAKE_SENTRY_DSN = 'https://fe3163e2e@example.invalid/1'
const ENVELOPE_URL = 'https://example.invalid/api/1/envelope/*'
const CRASH_MESSAGE_MARKER = 'e2e: simulated Safari directive-tuple'

interface SentryErrorEventLike {
  tags?: Record<string, unknown>
  contexts?: Record<string, unknown>
  exception?: { values?: { stacktrace?: { frames?: unknown[] } }[] }
}

interface VueDirectiveRuntimeContext {
  frontend_version?: string
  frontend_commit?: string
  loaded_script_count?: number
  first_party_script_paths?: string[]
}

async function mockRemoteConfigSentryDsn(page: Page): Promise<void> {
  await page.route('**/api/features', async (route) => {
    const response = await route.fetch()
    const body = (await response.json()) as RemoteConfig
    await route.fulfill({
      response,
      json: { ...body, sentry_dsn: FAKE_SENTRY_DSN } satisfies RemoteConfig
    })
  })
}

function watchForCrashEnvelope(page: Page): Promise<string> {
  return new Promise<string>((resolve) => {
    void page.route(ENVELOPE_URL, async (route) => {
      const body = route.request().postData() ?? ''
      if (body.includes(CRASH_MESSAGE_MARKER)) resolve(body)
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: '{"id":"fe3163-e2e"}'
      })
    })
  })
}

async function injectDirectiveCrash(page: Page): Promise<void> {
  const message = `${CRASH_MESSAGE_MARKER} destructuring failure (FE-3163)`
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

function findErrorEvent(envelope: string): SentryErrorEventLike {
  for (const line of envelope.split('\n')) {
    if (!line.trim()) continue
    try {
      const parsed = JSON.parse(line) as SentryErrorEventLike
      if (parsed.exception) return parsed
    } catch {
      // Not every line is JSON on its own (envelope/item headers mixed with
      // payloads) - only payload lines matter here.
    }
  }
  throw new Error(`No error event payload found in envelope:\n${envelope}`)
}

function expectVueDirectiveContext(event: SentryErrorEventLike): void {
  expect(event.tags?.diagnostic).toBe('vue_directive_runtime')

  const context = event.contexts?.vue_directive_runtime as
    | VueDirectiveRuntimeContext
    | undefined
  expect(context?.frontend_version).toBeTruthy()
  expect(context?.frontend_commit).toBeTruthy()
  expect(context?.loaded_script_count).toBeGreaterThan(0)
  expect(context?.first_party_script_paths).toHaveLength(
    context?.loaded_script_count ?? -1
  )
}

test.describe(
  'FE-3163: Vue directive failure Sentry attribution',
  { tag: '@mobile-ios' },
  () => {
    test('tags a directive-shaped crash for production attribution', async ({
      page
    }) => {
      await mockRemoteConfigSentryDsn(page)
      const crashEnvelope = watchForCrashEnvelope(page)

      await page.goto(APP_URL)
      await expect(page.getByRole('button', { name: /google/i })).toBeVisible({
        timeout: 30_000
      })

      await injectDirectiveCrash(page)

      const event = findErrorEvent(await crashEnvelope)
      expectVueDirectiveContext(event)
    })
  }
)
