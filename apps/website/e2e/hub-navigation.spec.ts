import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

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
  explore: { path: '/hub/', heading: 'Find your starting point.' },
  apps: { path: '/hub/apps/', heading: 'ComfyUI apps' },
  workflows: { path: '/hub/workflows/', heading: 'ComfyUI workflows' },
  models: { path: '/hub/models/', heading: 'ComfyUI models' }
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
      copy: 'Turn your ideas into finished results'
    },
    { from: 'apps', to: 'explore', copy: 'What do you want to make?' }
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
        await expect(page.getByTestId('workshop-hero')).toBeVisible()
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

for (const { section, query, filter } of [
  {
    section: 'models' as const,
    query: 'kling',
    filter: 'useCase=generate-images'
  },
  {
    section: 'workflows' as const,
    query: 'material',
    filter: 'category=product'
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

test('the mobile menu closes and reopens after its Explore the Hub link navigates', async ({
  page
}) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await page.goto('/hub/workflows/')
  const toggle = page.getByRole('button', { name: 'Toggle menu' })
  await waitForIsland(page, toggle)
  await toggle.click()
  const menu = page.getByRole('dialog', { name: 'Menu' })
  await expect(menu).toBeVisible()
  await menu.getByRole('button', { name: /^Products/ }).click()
  await menu.getByRole('link', { name: 'Explore the Hub' }).click()
  await expect(page).toHaveURL('/hub/')
  await expect(menu).toBeHidden()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Find your starting point.'
  )
  await waitForIsland(page, toggle)
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await toggle.click()
  await expect(menu).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(menu).toBeHidden()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
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
