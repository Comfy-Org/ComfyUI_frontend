import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import type { RemoteConfig } from '@/platform/remoteConfig/types'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'

/**
 * `.invalid` is reserved by RFC 2606 and never resolves anywhere real;
 * `initSentry.test.ts` uses the same style of fake DSN for the same reason -
 * it only needs to parse, not to be reachable, since the test fulfils the
 * envelope request itself.
 */
const FAKE_SENTRY_DSN = 'https://fe3163e2e@example.invalid/1'
const ENVELOPE_URL = 'https://example.invalid/api/1/envelope/*'

/**
 * Marks the exception this test throws so its envelope can be told apart
 * from the app's own startup Sentry traffic - on this cloud build, pointed
 * at a local backend with no real remote config, app startup emits its own
 * unrelated warning event (missing Firebase project name) over the same
 * envelope endpoint before this test's injected error ever fires.
 */
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

/**
 * `main.ts` only enables Sentry when `!import.meta.env.DEV && !!dsn`. In
 * production builds `DEV` is already `false`; the cloud distribution
 * additionally sources `dsn` from remote config at runtime
 * (`resolveRuntimeSentryDsn` -> `configValueOrDefault(remoteConfig.value,
 * 'sentry_dsn', __SENTRY_DSN__)`), so layering a DSN onto `/api/features` is
 * what actually turns Sentry on for this run - the same mechanism production
 * uses to roll out or rotate a DSN without a rebuild.
 */
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

/**
 * Sentry's session envelope (sent on page load) and the app's own startup
 * diagnostics (e.g. a missing-Firebase-project warning, fired by this cloud
 * build against a local backend with no real remote config) hit the same
 * endpoint before this test's injected error ever fires. Resolves only once
 * the envelope carrying this test's own marked exception arrives, rather
 * than on whichever one lands first.
 */
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

/**
 * A real uncaught exception, not a direct call into Sentry's API or the
 * app's diagnostic module - Sentry's own `globalHandlersIntegration` (a
 * default integration the cloud distribution keeps enabled) is what turns
 * this into a captured event, exactly as it would in production.
 * `isVueDirectiveFailure` only checks for a stack frame named
 * `withDirectives`; the Vue destructuring crash matches it without needing
 * a real directive render to reproduce the exact bug.
 *
 * This must land as a real `<script>` element via `addScriptTag` rather
 * than `page.evaluate`: WebKit only attaches a script URL and line/column
 * to `Error.stack` frames for code that has a document location. Code run
 * through `page.evaluate` has no such location on WebKit (frames look like
 * `withDirectives@` with nothing after the `@`), so Sentry's stack parser
 * drops every frame and the diagnostic never attaches - behavior specific
 * to WebKit's CDP-equivalent evaluation, unrelated to the app under test.
 */
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

/**
 * A Sentry envelope is newline-delimited: an envelope header line, then one
 * header+payload pair per item. Finds the item that looks like the error
 * event (it carries `exception`/`tags`/`contexts`) rather than assuming a
 * fixed line index, since `beforeSend` is free to run more than once and
 * other integrations (session updates, breadcrumbs) can add their own items.
 */
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
    /**
     * This is the regression coverage FE-3163 asked for, scoped to what
     * `main` actually ships (see PR #20000): main does not patch Vue, so a
     * directive-shaped crash still reaches the app's `beforeSend` and must
     * come out correctly tagged for production attribution. It does not,
     * and cannot, assert that the app survives the crash - that fix
     * (PR #19870) exists only on `cloud/1.54`, not on `main`.
     */
    test('tags a directive-shaped crash for production attribution', async ({
      page
    }) => {
      await mockRemoteConfigSentryDsn(page)
      const crashEnvelope = watchForCrashEnvelope(page)

      await page.goto(APP_URL)
      // Sentry finishes initializing earlier in `main.ts`'s bootstrap than
      // this renders; the button is only a readiness gate so the test
      // doesn't race the app's startup sequence on a slow WebKit boot.
      await expect(page.getByRole('button', { name: /google/i })).toBeVisible({
        timeout: 30_000
      })

      await injectDirectiveCrash(page)

      const event = findErrorEvent(await crashEnvelope)
      expectVueDirectiveContext(event)
    })
  }
)
