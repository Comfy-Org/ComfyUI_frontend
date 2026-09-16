import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'
import { waitForIsland } from './fixtures/islands'

const CATALOGUE = '/models-v2/'

const grid = (page: Page) => page.getByTestId('catalogue-grid')

test.describe('V2 catalogue', () => {
  test('browses models and workflows in one grid', async ({ page }) => {
    await page.goto(CATALOGUE)
    await waitForIsland(page, page.getByTestId('catalogue-browse'))

    const cards = grid(page).getByTestId('catalogue-card')
    await expect(cards.first()).toBeVisible()
    // Capabilities read first, then what is built on them.
    await expect(cards.first()).toHaveAttribute('data-kind', 'model')
    await expect(page.getByTestId('catalogue-showing')).toContainText(/\d+/)
  })

  test('the type facet narrows to one kind and says how many', async ({
    page
  }) => {
    await page.goto(CATALOGUE)
    await waitForIsland(page, page.getByTestId('catalogue-browse'))

    const facet = page.getByTestId('catalogue-type-facet')
    const workflows = facet.getByRole('button', { name: /^Workflows/ })
    await expect(workflows).toHaveAttribute('aria-pressed', 'false')
    await workflows.click()
    await expect(workflows).toHaveAttribute('aria-pressed', 'true')

    const kinds = await grid(page)
      .getByTestId('catalogue-card')
      .evaluateAll((cards) =>
        cards.map((card) => card.getAttribute('data-kind'))
      )
    expect(kinds.length).toBeGreaterThan(0)
    expect([...new Set(kinds)]).toEqual(['workflow'])
  })

  test('a search with no answer says so instead of showing nothing', async ({
    page
  }) => {
    await page.goto(CATALOGUE)
    await waitForIsland(page, page.getByTestId('catalogue-browse'))

    await page.getByRole('searchbox').fill('zzzz-no-such-thing')
    await expect(page.getByTestId('catalogue-empty')).toBeVisible()
    await expect(grid(page)).toHaveCount(0)
  })

  test('a model card opens the model, not one of its operations', async ({
    page
  }) => {
    await page.goto(CATALOGUE)
    await waitForIsland(page, page.getByTestId('catalogue-browse'))

    const card = grid(page)
      .getByTestId('catalogue-card')
      .filter({ has: page.locator('[data-kind="model"]') })
      .first()
    const href = await card
      .getByTestId('catalogue-card-link')
      .getAttribute('href')
    expect(href).toMatch(/^\/models-v2\/model\/[a-z0-9]+\/$/)

    await card.getByTestId('catalogue-card-link').click()
    await expect(page).toHaveURL(new RegExp(`${href}$`))
    await expect(page.getByTestId('model-operations')).toBeVisible()
  })

  test('a workflow page names what it loads, needs and produces', async ({
    page
  }) => {
    await page.goto('/models-v2/workflow/video_minimax_h3_i2v/')

    await expect(page.getByTestId('workflow-kind')).toContainText(/Workflow/i)
    await expect(page.getByTestId('workflow-outputs')).toBeVisible()
    await expect(page.getByTestId('workflow-needs')).toBeVisible()
    await expect(
      page.getByTestId('workflow-actions').getByRole('link').first()
    ).toHaveAttribute('href', /workflow_templates/)
  })

  // The card's crossing is navigation and stays in V2; this button is the run
  // itself, so it goes to the page that can actually perform one.
  test('sends a partner workflow to the model that can run it', async ({
    page
  }) => {
    await page.goto('/models-v2/workflow/api_nano_banana_pro/')

    const destination = page.getByTestId('workflow-destination')
    await expect(destination).toBeVisible()
    await expect(destination.getByRole('link')).toHaveAttribute(
      'href',
      /^\/(models|workshop)\//
    )
  })

  test('the prototype asks not to be indexed', async ({ request }) => {
    const response = await request.get(CATALOGUE)
    expect(response.ok()).toBe(true)
    expect(await response.text()).toContain('noindex')
  })
})
