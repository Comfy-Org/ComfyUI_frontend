import type { BrowserContext, Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'
import { MODEL_PATH } from './fixtures/modelsAccount'

declare global {
  interface Window {
    __renderGuard?: { cls: number; loaderLastSeenAt?: number }
  }
}

const CLS_BUDGET = 0.1
const LOADER_GRACE_MS = 1_000

type GuardedPage = {
  path: string
  heading: string
  kind: 'model' | 'catalogue'
  htmlPending?: string
  runtimePending?: string
}

const PAGES: readonly GuardedPage[] = [
  { path: MODEL_PATH, heading: 'FLUX 2 Max Text-to-Image', kind: 'model' },
  {
    path: '/models/byteplus--seedance-2-5-text-to-video--generate-videos/',
    heading: 'Seedance 2.5 Text-to-Video',
    kind: 'model'
  },
  {
    path: '/models/bria--eraser--edit-images/',
    heading: 'Bria Eraser',
    kind: 'model'
  },
  {
    path: '/models/',
    heading: 'ComfyUI models',
    kind: 'catalogue',
    htmlPending: 'The catalogue h1 and model links reach the HTML in #18898',
    runtimePending:
      'The catalogue grid shows a loader until catalogue.json arrives, also after #18898'
  }
]

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 }
] as const

async function answerWorkshopFlag(context: BrowserContext, enabled: boolean) {
  await context.route('**/cdn-cgi/trace', (route) =>
    route.fulfill({ contentType: 'text/plain', body: 'loc=US\n' })
  )
  await context.route('**/t.comfy.org/**', (route) =>
    /\/(flags|decide)\//.test(route.request().url())
      ? route.fulfill({
          json: {
            featureFlags: { 'workshop-enabled': enabled },
            featureFlagPayloads: {}
          }
        })
      : route.abort('blockedbyclient')
  )
}

async function recordLoaderAndLayoutShift(page: Page) {
  await page.addInitScript(() => {
    const guard: NonNullable<Window['__renderGuard']> = { cls: 0 }
    window.__renderGuard = guard
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (
          'hadRecentInput' in entry &&
          !entry.hadRecentInput &&
          'value' in entry &&
          typeof entry.value === 'number'
        )
          guard.cls += entry.value
      }
    }).observe({ type: 'layout-shift', buffered: true })
    const watchLoader = () => {
      const loader = document.querySelector('[data-testid="workshop-loading"]')
      if (loader?.checkVisibility()) guard.loaderLastSeenAt = performance.now()
      requestAnimationFrame(watchLoader)
    }
    requestAnimationFrame(watchLoader)
  })
}

async function waitUntilSettled(page: Page, kind: GuardedPage['kind']) {
  if (kind === 'model') {
    await expect(
      page
        .locator('astro-island')
        .filter({ has: page.getByTestId('model-detail') })
    ).not.toHaveAttribute('ssr')
    await expect(page.locator('[data-gate="resolving"]')).toHaveCount(0)
  } else {
    await expect(page.getByTestId('workshop-model-card').first()).toBeVisible()
  }
  await page.waitForFunction(
    (graceMs) => performance.now() > graceMs,
    LOADER_GRACE_MS
  )
}

test.describe('models pages without JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  for (const { path, heading, kind, htmlPending } of PAGES) {
    test(`${path} shows its h1 and no loader or showcase`, async ({ page }) => {
      test.fail(!!htmlPending, htmlPending)
      await page.goto(path)
      const h1 = page.getByRole('heading', { level: 1 })
      await expect(h1).toHaveCount(1)
      await expect(h1).toHaveText(heading)
      await expect(page.getByTestId('workshop-loading')).toBeHidden()
      await expect(page.getByText(/Grok Imagine in ComfyUI/)).toHaveCount(0)
      if (kind === 'catalogue')
        await expect(
          page.locator('main a[href^="/models/"][href*="--"]').first()
        ).toBeVisible()
    })
  }
})

for (const viewport of VIEWPORTS) {
  test.describe(`models pages on ${viewport.name}`, () => {
    test.use({ viewport })

    for (const enabled of [true, false]) {
      for (const { path, heading, kind, runtimePending } of PAGES) {
        test(`${path} with the flag ${enabled ? 'on' : 'off'} settles without a loader or layout jump`, async ({
          context,
          page
        }) => {
          test.fail(!!runtimePending, runtimePending)
          await answerWorkshopFlag(context, enabled)
          await recordLoaderAndLayoutShift(page)
          await page.goto(path)

          const h1 = page.getByRole('heading', { level: 1 })
          await expect(h1).toHaveCount(1)
          await expect(h1).toHaveText(heading)
          await waitUntilSettled(page, kind)
          await expect(h1).toHaveCount(1)

          const { cls, loaderLastSeenAt = 0 } = await page.evaluate(
            () => window.__renderGuard ?? { cls: Number.POSITIVE_INFINITY }
          )
          test.info().annotations.push({
            type: 'render-guard',
            description: `cls=${cls} loaderLastSeenAt=${loaderLastSeenAt}`
          })
          expect(
            loaderLastSeenAt,
            'ms after navigation the loader was last visible'
          ).toBeLessThan(LOADER_GRACE_MS)
          expect(cls, 'cumulative layout shift').toBeLessThan(CLS_BUDGET)
        })
      }
    }
  })
}
