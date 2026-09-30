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

for (const width of [1440, 390]) {
  test.describe(`Hub navigation at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } })

    for (const { from, to } of [
      { from: 'models', to: 'workflows' },
      { from: 'workflows', to: 'apps' },
      { from: 'apps', to: 'models' }
    ]) {
      test(`${from} to ${to} keeps the page steady, including Back and Forward`, async ({
        page
      }) => {
        const errors: string[] = []
        page.on('pageerror', (error) => errors.push(error.message))
        await page.goto(`/hub/${from}/`)
        await expect(page.getByTestId(`catalogue-tab-${from}`)).toHaveAttribute(
          'aria-current',
          'page'
        )
        await page.getByRole('button', { name: 'Close', exact: true }).click()
        await expect(
          page.getByText('Comfy Agent can now build workflows inside ComfyUI.')
        ).toBeHidden()
        const observation = await observeHubNavigation(page)

        await page.getByTestId(`catalogue-tab-${to}`).click()
        await expect(page).toHaveURL(`/hub/${to}/`)
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(
          `ComfyUI ${to}`
        )
        await expect(page.getByTestId(`catalogue-tab-${to}`)).toHaveAttribute(
          'aria-current',
          'page'
        )
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
          'href',
          `https://comfy.org/hub/${to}/`
        )

        await page.goBack()
        await expect(page).toHaveURL(`/hub/${from}/`)
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(
          `ComfyUI ${from}`
        )
        await expect(page.getByTestId(`catalogue-tab-${from}`)).toHaveAttribute(
          'aria-current',
          'page'
        )
        await page.goForward()
        await expect(page).toHaveURL(`/hub/${to}/`)
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(
          `ComfyUI ${to}`
        )
        await expect(page.getByTestId(`catalogue-tab-${to}`)).toHaveAttribute(
          'aria-current',
          'page'
        )

        const { frames, ...changes } = await observation.finish()
        expect(frames).toBeGreaterThan(0)
        expect(changes).toEqual({
          bannerReappeared: false,
          tabsDisappeared: false,
          loaderAppeared: false,
          headerMoved: false,
          tabsMoved: false
        })
        expect(errors).toEqual([])
        await page.reload()
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(
          `ComfyUI ${to}`
        )
        await expect(page.getByTestId(`catalogue-tab-${to}`)).toHaveAttribute(
          'aria-current',
          'page'
        )
      })
    }
  })
}

for (const { section, destination, query, filter } of [
  {
    section: 'models',
    destination: 'workflows',
    query: 'kling',
    filter: 'useCase=generate-images'
  },
  {
    section: 'workflows',
    destination: 'models',
    query: 'material',
    filter: 'category=product'
  }
]) {
  test(`the active ${section} tab resets its URL filters, including history`, async ({
    page
  }) => {
    const filtered = `/hub/${section}/?q=${query}&${filter}`
    await page.goto(filtered)
    const search = page.getByTestId('workshop-search')
    const count = page.getByTestId('workshop-filter-count')
    await expect(search).toHaveValue(query)
    await expect(count).toHaveText('1')
    await page.getByTestId(`catalogue-tab-${section}`).click()
    await expect(page).toHaveURL(`/hub/${section}/`)
    await expect(search).toHaveValue('')
    await expect(count).toHaveCount(0)
    await page.goBack()
    await expect(page).toHaveURL(filtered)
    await expect(search).toHaveValue(query)
    await expect(count).toHaveText('1')
    await page.goForward()
    await expect(page).toHaveURL(`/hub/${section}/`)
    await expect(search).toHaveValue('')
    await expect(count).toHaveCount(0)
  })

  test(`switching from filtered ${section} does not carry filters to ${destination}`, async ({
    page
  }) => {
    const filtered = `/hub/${section}/?q=${query}&${filter}`
    const search = page.getByTestId('workshop-search')
    const count = page.getByTestId('workshop-filter-count')
    await page.goto(filtered)
    await expect(search).toHaveValue(query)
    await expect(count).toHaveText('1')
    await page.getByTestId(`catalogue-tab-${destination}`).click()
    await expect(page).toHaveURL(`/hub/${destination}/`)
    await expect(search).toHaveValue('')
    await expect(count).toHaveCount(0)
    await page.goBack()
    await expect(page).toHaveURL(filtered)
    await expect(search).toHaveValue(query)
    await expect(count).toHaveText('1')
    await page.goForward()
    await expect(page).toHaveURL(`/hub/${destination}/`)
    await expect(search).toHaveValue('')
    await expect(count).toHaveCount(0)
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
  await menu.getByRole('link', { name: /^Hub\b/ }).click()
  await expect(page).toHaveURL('/hub/models/')
  await expect(menu).toBeHidden()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'ComfyUI models'
  )
  await waitForIsland(page, toggle)
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await toggle.click()
  await expect(menu).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(menu).toBeHidden()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})

test('keeps the current listing visible until a cold destination is ready', async ({
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
  await page.goto('/hub/models/')
  await expect(page.getByTestId('catalogue-tab-models')).toHaveAttribute(
    'aria-current',
    'page'
  )
  await page.getByTestId('catalogue-tab-workflows').click()
  await requested.promise
  try {
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'ComfyUI models'
    )
    await expect(page.getByTestId('catalogue-tab-models')).toHaveAttribute(
      'aria-current',
      'page'
    )
    await expect(page.getByTestId('workshop-sections')).toBeVisible()
  } finally {
    release.resolve()
  }
  await expect(page).toHaveURL('/hub/workflows/')
  await expect(page.getByTestId('workflow-catalogue')).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'ComfyUI workflows'
  )
})
