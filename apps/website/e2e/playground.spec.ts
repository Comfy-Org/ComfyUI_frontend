import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'
import { waitForIsland } from './fixtures/islands'

const CATALOGUE = '/playground/'

// The catalogue opens on its shelves; asking it anything is what makes a list.
const openShelf = async (page: Page, useCase: string) => {
  await waitForIsland(page, page.getByTestId('catalogue-browse'))
  await page.getByTestId(`shelf-${useCase}-see-all`).click()
}

const grid = (page: Page) => page.getByTestId('catalogue-grid')

test.describe('V2 catalogue', () => {
  test('opens on one shelf per thing you might make', async ({ page }) => {
    await page.goto(CATALOGUE)
    await waitForIsland(page, page.getByTestId('catalogue-browse'))

    const shelves = page
      .getByTestId('playground-sections')
      .locator('[data-testid^="shelf-"][aria-labelledby]')
    expect(await shelves.count()).toBeGreaterThan(1)
    await expect(page.getByTestId('catalogue-grid')).toHaveCount(0)

    // Capabilities read before the workflows built on them, inside the shelf.
    const first = page
      .getByTestId('shelf-generate-images')
      .getByTestId('catalogue-card')
      .first()
    await expect(first).toHaveAttribute('data-kind', 'model')
  })

  test('a shelf opens into the list for that use case', async ({ page }) => {
    await page.goto(CATALOGUE)
    await openShelf(page, 'generate-images')

    await expect(grid(page).getByTestId('catalogue-card').first()).toBeVisible()
    await expect(page.getByTestId('catalogue-showing')).toContainText(/\d+/)
    await expect(page.getByTestId('catalogue-heading')).toContainText(/image/i)
  })

  test('the type is a mark on the card until the reader asks for it', async ({
    page
  }) => {
    await page.goto(CATALOGUE)
    await openShelf(page, 'generate-images')

    const card = grid(page).getByTestId('catalogue-card').first()
    const badge = card.getByTestId('hub-type-badge')
    const width = async () => (await badge.boundingBox())?.width ?? 0

    // The word is there for a screen reader the whole time; what hovering
    // changes is whether it takes any room.
    await expect(badge).toHaveText(/model|workflow|app/i)
    const closed = await width()

    await card.hover()
    await expect.poll(width).toBeGreaterThan(closed)
  })

  test('the type facet narrows to one kind and says how many', async ({
    page
  }) => {
    await page.goto(CATALOGUE)
    await openShelf(page, 'generate-images')

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
    await openShelf(page, 'generate-images')

    const card = grid(page)
      .getByTestId('catalogue-card')
      .filter({ has: page.locator('[data-kind="model"]') })
      .first()
    const href = await card
      .getByTestId('catalogue-card-link')
      .getAttribute('href')
    expect(href).toMatch(/^\/playground\/model\/[a-z0-9]+\/$/)

    await card.getByTestId('catalogue-card-link').click()
    await expect(page).toHaveURL(new RegExp(`${href}$`))
    await expect(page.getByTestId('model-run')).toBeVisible()
  })

  test('a workflow page names what it loads, needs and produces', async ({
    page
  }) => {
    await page.goto('/playground/workflow/video_minimax_h3_i2v/')

    await expect(page.getByTestId('workflow-kind')).toContainText(/Workflow/i)
    await expect(page.getByTestId('workflow-outputs')).toBeVisible()
    await expect(page.getByTestId('workflow-needs')).toBeVisible()
    await expect(
      page.getByTestId('workflow-actions').getByRole('link').first()
    ).toHaveAttribute('href', /workflow_templates/)
  })

  test('sends a partner workflow to the model that can run it', async ({
    page
  }) => {
    await page.goto('/playground/workflow/api_nano_banana_pro/')

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
