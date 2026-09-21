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
  })

  // A model is a capability and a workflow is a job, so each tab is its own
  // catalogue rather than a filter over one shared list.
  test('gives each tab its own shelves', async ({ page }) => {
    await page.goto(CATALOGUE)
    await waitForIsland(page, page.getByTestId('catalogue-browse'))

    const kinds = () =>
      page
        .getByTestId('shelf-generate-images')
        .getByTestId('catalogue-card')
        .evaluateAll((cards) => [
          ...new Set(cards.map((card) => card.getAttribute('data-kind')))
        ])

    await expect.poll(kinds).not.toContain('model')

    await page.getByTestId('catalogue-type-model').click()
    await expect.poll(kinds).toEqual(['model'])
  })

  // Three of the eight use cases hold no model at all, and an empty shelf
  // reads as a broken catalogue rather than as a tab that has none.
  test('leaves out a use case the chosen tab has nothing in', async ({
    page
  }) => {
    await page.goto(CATALOGUE)
    await waitForIsland(page, page.getByTestId('catalogue-browse'))

    await expect(page.getByTestId('shelf-3d')).toBeVisible()
    await page.getByTestId('catalogue-type-model').click()
    await expect(page.getByTestId('shelf-3d')).toHaveCount(0)
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
    await expect(badge).toHaveText(/model|workflow/i)
    const closed = await width()

    await card.hover()
    await expect.poll(width).toBeGreaterThan(closed)
  })

  test('the tab decides which kind the list holds', async ({ page }) => {
    await page.goto(CATALOGUE)
    await openShelf(page, 'generate-images')

    const models = page.getByTestId('catalogue-type-model')
    await expect(models).toHaveAttribute('aria-pressed', 'false')
    await models.click()
    await expect(models).toHaveAttribute('aria-pressed', 'true')

    const kinds = await grid(page)
      .getByTestId('catalogue-card')
      .evaluateAll((cards) =>
        cards.map((card) => card.getAttribute('data-kind'))
      )
    expect(kinds.length).toBeGreaterThan(0)
    expect([...new Set(kinds)]).toEqual(['model'])
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
    await page.getByTestId('catalogue-type-model').click()
    await openShelf(page, 'generate-images')

    const card = grid(page).getByTestId('catalogue-card').first()
    const href = await card
      .getByTestId('catalogue-card-link')
      .getAttribute('href')
    // The key is the model half of a registry slug, so it stops before the
    // operation every row appends: two segments where a row carries three.
    expect(href).toMatch(/^\/playground\/model\/[a-z0-9.-]+--[a-z0-9.-]+\/$/)
    expect(href!.split('--')).toHaveLength(2)

    await card.getByTestId('catalogue-card-link').click()
    await expect(page).toHaveURL(new RegExp(`${href}$`))
    await expect(page.getByTestId('model-run')).toBeVisible()
  })

  test('a workflow page names what it loads, runs on and produces', async ({
    page
  }) => {
    await page.goto('/playground/workflow/video_minimax_h3_i2v/')

    await expect(page.getByTestId('workflow-kind')).toContainText(/Workflow/i)
    await expect(page.getByTestId('workflow-outputs')).toBeVisible()
    // The model it calls is the part the reader cannot work out from the
    // inputs and outputs, so it is the one the page has to name.
    await expect(page.getByTestId('workflow-runs-on')).toBeVisible()
    // The graph hydrates on sight, so it has to be in view before it has
    // drawn anything to assert on.
    await waitForIsland(page, page.getByTestId('workflow-graph'))
    await expect(
      page.getByTestId('workflow-graph').getByRole('img')
    ).toBeVisible()
  })

  // The way out and the way to keep it are both offered, and the graph opens
  // in the reader's own Cloud rather than downloading.
  test('a workflow page opens its graph in the Cloud and offers the file', async ({
    page
  }) => {
    await page.goto('/playground/workflow/video_minimax_h3_i2v/')

    // The graph is what decides whether to take the workflow anywhere, so the
    // two ways of taking it live with it rather than in the sidebar.
    const actions = page
      .getByTestId('workflow-graph-section')
      .getByTestId('workflow-actions')
    await expect(actions.getByTestId('workflow-open-cloud')).toHaveAttribute(
      'href',
      /cloud\.comfy\.org\/\?template=video_minimax_h3_i2v/
    )
    await expect(
      actions.getByRole('link', { name: /Download the JSON/ })
    ).toHaveAttribute('href', /workflow_templates/)
  })

  // A workflow that is one call to a model the catalogue carries is that
  // model with its graph around it, so the page runs rather than sending the
  // reader somewhere else.
  test('runs a partner workflow on its own page', async ({ page }) => {
    await page.goto('/playground/workflow/api_nano_banana_pro/')

    await expect(page.getByTestId('workflow-run')).toBeVisible()
    await expect(page.getByTestId('workflow-kind')).toContainText(/Runs here/i)
    await expect(page.getByTestId('workflow-destination')).toHaveCount(0)
  })

  test('the prototype asks not to be indexed', async ({ request }) => {
    const response = await request.get(CATALOGUE)
    expect(response.ok()).toBe(true)
    expect(await response.text()).toContain('noindex')
  })
})
