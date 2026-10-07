import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'
import { observeHubNavigation } from './fixtures/hubNavigation'
import { waitForIsland } from './fixtures/islands'
import { stubWorkshopFlags } from './fixtures/workshopFlags'

test.beforeEach(async ({ context }) => {
  await stubWorkshopFlags(context, {
    'workshop-enabled': true,
    'workshop-auth': false,
    'workshop-workflows-enabled': true,
    'workshop-apps-enabled': true
  })
})

const SECTIONS = {
  explore: { path: '/hub/', heading: 'What do you want to make?' },
  apps: { path: '/hub/apps/', heading: 'Apps' },
  workflows: { path: '/hub/workflows/', heading: 'Workflows' },
  models: { path: '/hub/models/', heading: 'Models' }
} as const

type HubSection = keyof typeof SECTIONS

// The Hub is a landing that sends to each section, and each section leads
// back to it: there are no tabs joining the sections to each other.
function wayTo(page: Page, from: HubSection, to: HubSection) {
  if (to === 'explore') return page.getByTestId('hub-back')
  if (from !== 'explore')
    throw new Error(`${from} only leads back to the Hub, not to ${to}`)
  return page.getByTestId(`explore-door-${to}`)
}

async function expectAt(page: Page, section: HubSection) {
  await expect(page).toHaveURL(SECTIONS[section].path)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    SECTIONS[section].heading
  )
  await expect(page.getByTestId('hub-back')).toHaveCount(
    section === 'explore' ? 0 : 1
  )
}

async function navigateObservingCrossfade(
  page: Page,
  from: HubSection,
  to: HubSection
) {
  const motion = await page.evaluateHandle(() => {
    const observed = { crossfade: false }
    const finished = new Promise<void>((resolve) => {
      document.addEventListener(
        'astro:before-swap',
        (event) => {
          void event.viewTransition.finished.then(resolve)
        },
        { once: true }
      )
    })
    let frame: number
    function record() {
      observed.crossfade ||= [
        '::view-transition-old(root)',
        '::view-transition-new(root)'
      ].every((pseudo) => {
        const opacity = Number(
          getComputedStyle(document.documentElement, pseudo).opacity
        )
        return opacity > 0 && opacity < 1
      })
      frame = requestAnimationFrame(record)
    }
    record()
    return {
      observed,
      finished,
      stop() {
        cancelAnimationFrame(frame)
      }
    }
  })
  try {
    await wayTo(page, from, to).click()
    await expectAt(page, to)
    await motion.evaluate((probe) => probe.finished)
    return await motion.evaluate((probe) => probe.observed)
  } finally {
    await motion.evaluate((probe) => probe.stop())
    await motion.dispose()
  }
}

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  for (const { from, to, copy } of [
    {
      from: 'explore',
      to: 'workflows',
      copy: 'Open one, change any step'
    },
    {
      from: 'apps',
      to: 'explore',
      copy: 'Search, or pick how you want to work'
    }
  ] as const) {
    test(`${from} to ${to} crossfades only under no-preference (${reducedMotion})`, async ({
      page
    }) => {
      await page.emulateMedia({ reducedMotion })
      await page.goto(SECTIONS[from].path)
      await expectAt(page, from)

      const observed = await navigateObservingCrossfade(page, from, to)

      await expect(page.getByTestId('workshop-hero')).toContainText(copy)
      expect(observed).toEqual({
        crossfade: reducedMotion === 'no-preference'
      })
    })
  }
}

for (const width of [1440, 390]) {
  test.describe(`Hub navigation at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } })

    for (const { from, to } of [
      { from: 'explore', to: 'models' },
      { from: 'models', to: 'explore' },
      { from: 'explore', to: 'apps' },
      { from: 'workflows', to: 'explore' }
    ] as const) {
      test(`${from} to ${to} keeps the page steady, including Back and Forward`, async ({
        page
      }) => {
        const errors: string[] = []
        page.on('pageerror', (error) => errors.push(error.message))
        await page.goto(SECTIONS[from].path)
        await expectAt(page, from)
        await page.getByRole('button', { name: 'Close', exact: true }).click()
        await expect(
          page.getByText('Comfy Agent can now build workflows inside ComfyUI.')
        ).toBeHidden()
        await expect(
          page.getByTestId(
            from === 'models' ? 'models-hub-hero' : 'workshop-hero'
          )
        ).toBeVisible()
        const way = wayTo(page, from, to)
        await way.scrollIntoViewIfNeeded()
        const observation = await observeHubNavigation(page)

        await way.click()
        await expectAt(page, to)
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
          'href',
          `https://comfy.org${SECTIONS[to].path}`
        )

        await page.goBack()
        await expectAt(page, from)
        await page.goForward()
        await expectAt(page, to)

        const { frames, ...changes } = await observation.finish()
        expect(frames).toBeGreaterThan(0)
        expect(changes).toEqual({
          bannerReappeared: false,
          loaderAppeared: false,
          headerMoved: false
        })
        expect(errors).toEqual([])
        await page.reload()
        await expectAt(page, to)
      })
    }
  })
}

// A use case is a category on models, and a category hides the hub link behind
// its own way back, so the way to the Hub starts by leaving the category.
async function leaveCategory(page: Page) {
  await page.getByTestId('section-back').click()
  await expect(page.getByTestId('section-back')).toHaveCount(0)
}

for (const { section, query, filter, reachHubLink } of [
  {
    section: 'models' as const,
    query: 'kling',
    filter: 'useCase=generate-images',
    reachHubLink: leaveCategory
  },
  {
    section: 'workflows' as const,
    query: 'material',
    filter: 'category=product',
    reachHubLink: async () => {}
  }
]) {
  test(`leaving filtered ${section} through the Hub does not carry its filters back`, async ({
    page
  }) => {
    const filtered = `/hub/${section}/?q=${query}&${filter}`
    const search = page.getByTestId('workshop-search')
    const count = page.getByTestId('workshop-filter-count')
    await page.goto(filtered)
    await expect(search).toHaveValue(query)
    await expect(count).toHaveText('1')

    await reachHubLink(page)
    await page.getByTestId('hub-back').click()
    await expectAt(page, 'explore')
    await page.getByTestId(`explore-door-${section}`).click()

    await expect(page).toHaveURL(`/hub/${section}/`)
    await expect(search).toHaveValue('')
    await expect(count).toHaveCount(0)
    await page.goBack()
    await page.goBack()
    await expect(page).toHaveURL(filtered)
    await expect(search).toHaveValue(query)
    await expect(count).toHaveText('1')
  })
}

test('the mobile menu closes and reopens after its Hub link navigates', async ({
  page
}) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await page.goto('/hub/workflows/')
  const toggle = page.getByRole('button', { name: 'Toggle menu' })
  await waitForIsland(page, toggle)
  await toggle.click()
  const menu = page.getByRole('dialog', { name: 'Menu' })
  await expect(menu).toBeVisible()
  await menu.getByRole('button', { name: /^Hub/ }).click()
  await menu.getByRole('link', { name: /^Explore the Hub/ }).click()
  await expect(page).toHaveURL('/hub/')
  await expect(menu).toBeHidden()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'What do you want to make?'
  )
  await waitForIsland(page, toggle)
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await toggle.click()
  await expect(menu).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(menu).toBeHidden()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})

test('mobile search suggestions show a video model as a still frame', async ({
  page
}) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await page.goto('/hub/models/')
  const open = page.getByTestId('workshop-search-button')
  await waitForIsland(page, open)
  await open.click()
  await page.getByTestId('workshop-search-sheet-input').fill('seedance')
  const sheet = page.getByTestId('workshop-search-sheet')
  await expect(sheet.getByTestId('workshop-search-model')).toHaveCount(4)
  await expect(
    sheet.getByTestId('workshop-search-model-video')
  ).not.toHaveCount(0)
  await expect(
    sheet.locator('img[src*=".mp4"], img[src*=".webm"], img[src*=".mov"]')
  ).toHaveCount(0)
})

for (const width of [1440, 1360, 1280, 1024, 390]) {
  test(`each Hub door centres its words beside its panel at ${width}px`, async ({
    page
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/hub/')
    const doors = page.getByTestId('explore-doors').getByRole('link')
    await expect(doors).toHaveCount(3)

    for (const door of await doors.all()) {
      await expect(door.getByTestId('explore-door-panel')).toBeVisible()
      const layout = await door.evaluate((card) => {
        const box = (element: Element | null) => {
          if (!element) throw new Error('the door lost part of its layout')
          return element.getBoundingClientRect()
        }
        const copy = card.querySelector('[data-testid="explore-door-copy"]')
        const lines = [...(copy?.children ?? [])].map((line) => box(line))
        const panel = box(
          card.querySelector('[data-testid="explore-door-panel"]')
        )
        const own = box(card)
        const top = Math.min(...lines.map((line) => line.top))
        const bottom = Math.max(...lines.map((line) => line.bottom))
        return {
          offCentre: Math.abs((top + bottom) / 2 - (own.top + own.bottom) / 2),
          gap: panel.left - Math.max(...lines.map((line) => line.right))
        }
      })
      expect(layout.offCentre).toBeLessThan(2)
      expect(layout.gap).toBeGreaterThan(0)
    }
  })
}

test('Popular right now shows every format with no task chips', async ({
  page
}) => {
  await page.goto('/hub/')
  const popular = page.getByTestId('explore-results')
  await expect(
    popular.getByRole('heading', { name: 'Popular right now' })
  ).toBeVisible()
  await expect(popular.getByTestId('explore-kind')).not.toHaveCount(0)
  await expect(popular.getByRole('group')).toHaveCount(0)
  await expect(popular.getByRole('button', { name: 'All' })).toHaveCount(0)
})

test('a Hub search finds models, workflows and apps, and counts each kind', async ({
  page
}) => {
  await page.goto('/hub/')
  await page.getByTestId('explore-search').fill('relight')

  const results = page.getByTestId('explore-results')
  await expect(
    results.getByRole('heading', { name: 'Results for “relight”' })
  ).toBeVisible()
  await expect
    .poll(
      async () =>
        new Set(
          await results
            .getByTestId('explore-kind')
            .evaluateAll((tags) => tags.map((tag) => tag.dataset.kind))
        )
    )
    .toEqual(new Set(['model', 'workflow', 'app']))
  const counts = results.getByTestId('explore-counts').getByRole('link')
  await expect(counts).toHaveText([
    /^\d+ models?$/,
    /^\d+ workflows?$/,
    /^\d+ apps?$/
  ])
  await expect(counts.nth(0)).toHaveAttribute('href', '/hub/models/?q=relight')
  await expect(counts.nth(1)).toHaveAttribute(
    'href',
    '/hub/workflows/?q=relight'
  )
  await expect(results.getByText('See all models')).toHaveCount(0)
})

test('keeps the Hub visible until a cold section is ready', async ({
  page,
  context
}) => {
  const requested = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  await context.route('**/_website/WorkflowCatalogue.*.js', async (route) => {
    requested.resolve()
    await release.promise
    await route.fallback()
  })
  await page.goto('/hub/')
  await expectAt(page, 'explore')
  await page.getByTestId('explore-door-workflows').click()
  await requested.promise
  try {
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      SECTIONS.explore.heading
    )
    await expect(page.getByTestId('explore-catalogue')).toBeVisible()
  } finally {
    release.resolve()
  }
  await expectAt(page, 'workflows')
  await expect(page.getByTestId('workflow-catalogue')).toBeVisible()
})

// With no section tabs, the search owns the toolbar row, inside a category and
// out of it. The cap is read off the field, and the box shows the width really
// went to the field.
const NO_CAP = 'none'
const WIDER_THAN_OLD_CAP = 480

function searchField(page: Page) {
  return page.getByTestId('workshop-search-field')
}

async function expectSearchFillsRow(page: Page) {
  const field = searchField(page)
  await expect(field).toBeVisible()
  await expect(field).toHaveCSS('max-width', NO_CAP)
  const box = await field.boundingBox()
  if (!box) throw new Error('The search field has no box')
  expect(box.width).toBeGreaterThan(WIDER_THAN_OLD_CAP)
}

for (const { section, openCategory } of [
  {
    section: 'models',
    openCategory: (page: Page) =>
      page.goto('/hub/models/?useCase=generate-images')
  }
] as const) {
  test(`the ${section} search fills the toolbar row in and out of a category`, async ({
    page
  }) => {
    await page.goto(`/hub/${section}/`)
    await expectSearchFillsRow(page)

    await openCategory(page)
    await expect(page.getByTestId('section-back')).toBeVisible()
    await expectSearchFillsRow(page)

    await page.getByTestId('section-back').click()
    await expect(page.getByTestId('section-back')).toHaveCount(0)
    await expectSearchFillsRow(page)
  })
}
