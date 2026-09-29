import { readFileSync } from 'node:fs'

import type { APIRequestContext, Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { z } from 'zod'

import { test } from './fixtures/blockExternalMedia'
import { waitForIsland } from './fixtures/islands'
import { MODEL_PATH } from './fixtures/modelsAccount'
import { stubWorkshopFlags } from './fixtures/workshopFlags'
import { VIEWPORTS } from './viewports'

type RenderGuard = {
  cls: number
  loaderLastSeenAt: number
  frames: number
  flush: () => void
}
type RenderGuardWindow = Window & { __renderGuard?: RenderGuard }

const CLS_BUDGET = 0.1
const LOADER_GRACE_MS = 1_000

const catalogueSchema = z.array(
  z.object({
    slug: z.string(),
    href: z.string(),
    useCases: z.array(z.string()).optional()
  })
)
type CatalogueEntry = z.infer<typeof catalogueSchema>[number]

const displayEntries = z
  .array(
    z.object({
      slug: z.string(),
      examples: z.array(
        z.object({ values: z.record(z.string(), z.unknown()).optional() })
      )
    })
  )
  .parse(
    JSON.parse(
      readFileSync(
        new URL('../src/content/workshop-display.json', import.meta.url),
        'utf8'
      )
    )
  )
const slugsWithoutExampleValues = new Set(
  displayEntries.flatMap(({ slug, examples }) =>
    examples.length > 0 &&
    examples.every(({ values = {} }) => Object.keys(values).length === 0)
      ? [slug]
      : []
  )
)

type GuardedPage = {
  label: string
  kind: 'model' | 'catalogue'
} & ({ path: string } | { pick: (entry: CatalogueEntry) => boolean })

const PAGES: readonly GuardedPage[] = [
  { label: 'the shared image model', kind: 'model', path: MODEL_PATH },
  {
    label: 'the first video generation model',
    kind: 'model',
    pick: (entry) => entry.useCases?.includes('generate-videos') ?? false
  },
  {
    label: 'the first model with empty example values',
    kind: 'model',
    pick: (entry) => slugsWithoutExampleValues.has(entry.slug)
  },
  { label: 'the catalogue', kind: 'catalogue', path: '/models/' }
]

async function resolvePath(request: APIRequestContext, page: GuardedPage) {
  if ('path' in page) return page.path
  const response = await request.get('/models/catalogue.json')
  expect(response.ok()).toBe(true)
  const entry = catalogueSchema.parse(await response.json()).find(page.pick)
  if (!entry) throw new Error(`The catalogue has no ${page.label}`)
  return entry.href
}

const GUARD_VIEWPORTS = VIEWPORTS.filter(
  ({ name }) => name === '1-sm' || name === '3-lg'
)

async function recordLoaderAndLayoutShift(page: Page) {
  await page.addInitScript(() => {
    const addShifts = (entries: PerformanceEntryList) => {
      for (const entry of entries) {
        if (
          'hadRecentInput' in entry &&
          !entry.hadRecentInput &&
          'value' in entry &&
          typeof entry.value === 'number'
        )
          guard.cls += entry.value
      }
    }
    const observer = new PerformanceObserver((list) =>
      addShifts(list.getEntries())
    )
    const guard: RenderGuard = {
      cls: 0,
      loaderLastSeenAt: 0,
      frames: 0,
      flush: () => addShifts(observer.takeRecords())
    }
    ;(window as RenderGuardWindow).__renderGuard = guard
    observer.observe({ type: 'layout-shift', buffered: true })
    const watchLoader = () => {
      guard.frames++
      const loader = document.querySelector(
        '[data-testid="workshop-loading"], [data-testid="models-loading"]'
      )
      if (loader?.checkVisibility()) guard.loaderLastSeenAt = performance.now()
      requestAnimationFrame(watchLoader)
    }
    requestAnimationFrame(watchLoader)
  })
}

async function waitUntilSettled(
  page: Page,
  kind: GuardedPage['kind'],
  enabled: boolean
) {
  if (kind === 'model') {
    await waitForIsland(page, page.getByTestId('model-detail'))
    await expect(
      enabled
        ? page.locator(
            '[data-testid="run-button"]:not([data-gate="resolving"])'
          )
        : page.getByTestId('run-rollout-note')
    ).toBeVisible()
  } else {
    await waitForIsland(page, page.getByTestId('workshop-model-card').first())
  }
  await page.waitForFunction(
    (graceMs) => performance.now() > graceMs,
    LOADER_GRACE_MS
  )
}

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('/models/ shows the catalogue, not the showcase', async ({ page }) => {
    test.fail(
      true,
      'Until #18898 the noscript ModelsShowcase renders here, so the h1 reads "Grok Imagine in ComfyUI" and the no-Grok check fails too'
    )
    await page.goto('/models/')
    const h1 = page.getByRole('heading', { level: 1 })
    await expect(h1).toHaveCount(1)
    await expect(h1).toHaveText('ComfyUI models')
    await expect(page.getByText(/Grok Imagine in ComfyUI/)).toHaveCount(0)
    await expect(
      page.locator('main a[href^="/models/"][href*="--"]').first()
    ).toBeVisible()
  })
})

for (const { width, height } of GUARD_VIEWPORTS) {
  test.describe(`models pages at ${width}px`, () => {
    test.use({ viewport: { width, height } })

    for (const enabled of [true, false]) {
      for (const guarded of PAGES) {
        test(`${guarded.label} with the flag ${enabled ? 'on' : 'off'} settles without a loader or layout jump`, async ({
          context,
          page,
          request
        }) => {
          const path = await resolvePath(request, guarded)
          await stubWorkshopFlags(context, { 'workshop-enabled': enabled })
          await recordLoaderAndLayoutShift(page)
          const flagAnswered = page.waitForResponse((response) =>
            /t\.comfy\.org\/(flags|decide)\//.test(response.url())
          )
          await page.goto(path)
          await flagAnswered
          await waitUntilSettled(page, guarded.kind, enabled)

          const guard = await page.evaluate(() => {
            const state = (window as RenderGuardWindow).__renderGuard
            state?.flush()
            return (
              state && {
                cls: state.cls,
                loaderLastSeenAt: state.loaderLastSeenAt,
                frames: state.frames
              }
            )
          })
          if (!guard) throw new Error('The render guard never installed')
          const { cls, loaderLastSeenAt, frames } = guard
          expect(frames, 'frames the loader watcher ran').toBeGreaterThan(0)
          test.info().annotations.push({
            type: 'render-guard',
            description: `${path} cls=${cls} loaderLastSeenAt=${loaderLastSeenAt}`
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
