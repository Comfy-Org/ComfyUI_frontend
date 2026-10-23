import type { APIRequestContext, Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { z } from 'zod'

import { getRoutes } from '@/config/routes'
import { test } from './fixtures/blockExternalMedia'
import { expectIslandHydrated } from './fixtures/islands'
import { stubWorkshopFlags } from './fixtures/workshopFlags'
import { VIEWPORTS } from './viewports'

type RenderGuard = {
  cls: number
  loaderLastSeenAt: number
  frames: number
  hydratedAt: WeakMap<Element, number>
  flush: () => void
}
type RenderGuardWindow = Window & { __renderGuard?: RenderGuard }

const CLS_BUDGET = 0.1
// Counted from the moment the page's island hydrates, not from navigation:
// until then the server-rendered loader is waiting on the runner's network and
// CPU to boot the site's JavaScript, which is not what this guard is about. The
// no-JavaScript cases below cover model pages that ship a loader in their HTML.
const LOADER_GRACE_MS = 1_000

const catalogueSchema = z.array(
  z.object({ slug: z.string(), name: z.string(), href: z.string() })
)

const CATALOGUE_PATH = getRoutes().workshop

const MODEL_SLUGS = [
  'bfl--flux-2-max--generate-images',
  'byteplus--seedance-2-5-text-to-video--generate-videos',
  'bria--eraser--edit-images'
] as const

type GuardedPage =
  | { kind: 'model'; slug: string }
  | { kind: 'catalogue'; path: string }

const PAGES: readonly GuardedPage[] = [
  ...MODEL_SLUGS.map((slug) => ({ kind: 'model' as const, slug })),
  { kind: 'catalogue', path: CATALOGUE_PATH }
]

const pageTitle = (page: GuardedPage) =>
  page.kind === 'model' ? page.slug : page.path

async function publishedModel(request: APIRequestContext, slug: string) {
  const response = await request.get('/models/catalogue.json')
  expect(response.ok()).toBe(true)
  const entry = catalogueSchema
    .parse(await response.json())
    .find((candidate) => candidate.slug === slug)
  if (!entry) throw new Error(`The catalogue no longer publishes ${slug}`)
  return entry
}

async function resolvePage(request: APIRequestContext, page: GuardedPage) {
  if (page.kind === 'catalogue') return { path: page.path }
  const { href, name } = await publishedModel(request, page.slug)
  return { path: href, name }
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
      hydratedAt: new WeakMap(),
      flush: () => addShifts(observer.takeRecords())
    }
    ;(window as RenderGuardWindow).__renderGuard = guard
    observer.observe({ type: 'layout-shift', buffered: true })
    // Astro dispatches a non-bubbling `astro:hydrate` on each <astro-island>
    // once it hydrates, so listen in the capture phase.
    document.addEventListener(
      'astro:hydrate',
      (event) => {
        if (event.target instanceof Element)
          guard.hydratedAt.set(event.target, performance.now())
      },
      true
    )
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

/** Waits out the grace after the page island hydrates; returns when it hydrated. */
async function waitUntilSettled(
  page: Page,
  kind: GuardedPage['kind'],
  enabled: boolean
) {
  const content =
    kind === 'model'
      ? page.getByTestId('model-detail')
      : page.getByTestId('workshop-model-card').first()
  await expectIslandHydrated(page, content)
  if (kind === 'model')
    await expect(
      enabled
        ? page.locator(
            '[data-testid="run-button"]:not([data-gate="resolving"])'
          )
        : page.getByTestId('run-rollout-note')
    ).toBeVisible()
  const hydratedAt = await page
    .locator('astro-island')
    .filter({ has: content })
    .evaluate((island) =>
      (window as RenderGuardWindow).__renderGuard?.hydratedAt.get(island)
    )
  if (hydratedAt === undefined)
    throw new Error('The render guard never saw the page island hydrate')
  await page.waitForFunction(
    (settledAt) => performance.now() > settledAt,
    hydratedAt + LOADER_GRACE_MS
  )
  return hydratedAt
}

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  for (const slug of MODEL_SLUGS) {
    test(`${slug} shows its name as the only h1, with no loader or showcase`, async ({
      page,
      request
    }) => {
      const { href, name } = await publishedModel(request, slug)
      await page.goto(href)
      const h1 = page.getByRole('heading', { level: 1 })
      await expect(h1).toHaveCount(1)
      await expect(h1).toHaveText(name)
      await expect(page.getByTestId('workshop-loading')).toBeHidden()
      await expect(page.getByText(/Grok Imagine in ComfyUI/)).toHaveCount(0)
    })
  }

  test('the catalogue shows its heading, not the showcase', async ({
    page
  }) => {
    await page.goto(CATALOGUE_PATH)
    const h1 = page.getByRole('heading', { level: 1 })
    await expect(h1).toHaveCount(1)
    await expect(h1).toHaveText('ComfyUI models')
    await expect(page.getByText(/Grok Imagine in ComfyUI/)).toHaveCount(0)
    const directory = page
      .getByTestId('models-directory')
      .locator(`a[href^="${CATALOGUE_PATH}"]`)
    await expect(directory.first()).toBeHidden()
    await page.getByTestId('models-directory-toggle').click()
    await expect(directory.first()).toBeVisible()
  })
})

for (const { width, height } of GUARD_VIEWPORTS) {
  test.describe(`models pages at ${width}px`, () => {
    test.use({ viewport: { width, height } })

    for (const enabled of [true, false]) {
      for (const guarded of PAGES) {
        test(`${pageTitle(guarded)} with the flag ${enabled ? 'on' : 'off'} settles without a loader or layout jump`, async ({
          context,
          page,
          request
        }) => {
          const { path, name } = await resolvePage(request, guarded)
          await stubWorkshopFlags(context, { 'workshop-enabled': enabled })
          await recordLoaderAndLayoutShift(page)
          const flagAnswered = page.waitForResponse((response) =>
            /t\.comfy\.org\/(flags|decide)\//.test(response.url())
          )
          await page.goto(path)
          await flagAnswered
          const hydratedAt = await waitUntilSettled(page, guarded.kind, enabled)
          if (name)
            await expect(page.getByRole('heading', { level: 1 })).toHaveText(
              name
            )

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
          const loaderAfterHydration = Math.max(
            0,
            loaderLastSeenAt - hydratedAt
          )
          test.info().annotations.push({
            type: 'render-guard',
            description: `${path} cls=${cls} hydratedAt=${hydratedAt} loaderLastSeenAt=${loaderLastSeenAt}`
          })
          expect(
            loaderAfterHydration,
            'ms after the page island hydrated that the loader was last visible'
          ).toBeLessThan(LOADER_GRACE_MS)
          expect(cls, 'cumulative layout shift').toBeLessThan(CLS_BUDGET)
        })
      }
    }
  })
}
