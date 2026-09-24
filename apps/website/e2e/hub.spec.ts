import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'
import { waitForIsland } from './fixtures/islands'

const CATALOGUE = '/hub/'

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
      .getByTestId('hub-sections')
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

    await expect.poll(kinds).toEqual(['model'])

    await page.getByTestId('catalogue-type-workflow').click()
    await expect.poll(kinds).not.toContain('model')
  })

  // The two halves do not cover the same ground, and an empty shelf reads as
  // a broken catalogue rather than as a tab that has nothing there.
  test('leaves out a use case the chosen tab has nothing in', async ({
    page
  }) => {
    await page.goto(CATALOGUE)
    await waitForIsland(page, page.getByTestId('catalogue-browse'))

    await expect(page.getByTestId('shelf-audio')).toBeVisible()
    await page.getByTestId('catalogue-type-workflow').click()
    await expect(page.getByTestId('shelf-audio')).toHaveCount(0)
  })

  test('a shelf opens into the list for that use case', async ({ page }) => {
    await page.goto(CATALOGUE)
    await openShelf(page, 'generate-images')

    await expect(grid(page).getByTestId('catalogue-card').first()).toBeVisible()
    await expect(page.getByTestId('catalogue-showing')).toContainText(/\d+/)
    await expect(page.getByTestId('catalogue-heading')).toContainText(/image/i)
  })

  test('who answers for a card is a mark until the reader asks', async ({
    page
  }) => {
    await page.goto(CATALOGUE)
    await openShelf(page, 'generate-images')

    const card = grid(page).getByTestId('catalogue-card').first()
    const mark = card.getByTestId('hub-card-mark')
    const width = async () => (await mark.boundingBox())?.width ?? 0

    // The name is there for a screen reader the whole time; what hovering
    // changes is whether it takes any room.
    await expect(mark).not.toBeEmpty()
    const closed = await width()

    await card.hover()
    await expect.poll(width).toBeGreaterThan(closed)
  })

  test('the tab decides which kind the list holds', async ({ page }) => {
    await page.goto(CATALOGUE)
    await openShelf(page, 'generate-images')

    const models = page.getByTestId('catalogue-type-model')
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
    expect(href).toMatch(/^\/hub\/model\/[a-z0-9.-]+--[a-z0-9.-]+\/$/)
    expect(href!.split('--')).toHaveLength(2)

    await card.getByTestId('catalogue-card-link').click()
    await expect(page).toHaveURL(new RegExp(`${href}$`))
    await expect(page.getByTestId('model-run')).toBeVisible()
  })

  // The page opens on the thing to do. How the workflow is built is a second
  // question, so it waits behind the tab the model page already has for it.
  test('opens on the playground and keeps the graph behind its tab', async ({
    page
  }) => {
    await page.goto('/hub/workflow/utility_nanobanana_pro_product_upscale/')

    // The header names what answers for the workflow, the way a model page
    // names its provider: the model the graph calls.
    await expect(page.getByTestId('hub-header-eyebrow')).toContainText(
      /Nano Banana/i
    )
    await expect(page.getByTestId('playground-tab')).toBeVisible()
    await expect(page.getByTestId('workflow-about')).toHaveCount(0)

    await page.getByTestId('tab-details').click()
    await expect(page.getByTestId('playground-tab')).toHaveCount(0)
    // The form says what goes in and the output says what comes back, so the
    // model it calls is the one thing left for the page to name.
    await expect(page.getByTestId('workflow-runs-on')).toBeVisible()
    // The graph hydrates on sight, so it has to be in view before it has
    // drawn anything to assert on.
    await waitForIsland(page, page.getByTestId('workflow-graph'))
    await expect(
      page.getByTestId('workflow-graph').getByRole('img')
    ).toBeVisible()
  })

  // The way out and the way to keep it are both offered, beside the graph
  // that decides whether to take the workflow anywhere at all.
  test('a workflow page opens its graph in the Cloud and offers the file', async ({
    page
  }) => {
    await page.goto('/hub/workflow/utility_nanobanana_pro_product_upscale/')
    await page.getByTestId('tab-details').click()

    // Both stand together under the facts they act on.
    const actions = page.getByTestId('workflow-actions')
    await expect(actions.getByTestId('workflow-open-cloud')).toHaveAttribute(
      'href',
      /cloud\.comfy\.org\/\?template=utility_nanobanana_pro_product_upscale/
    )
    await expect(
      actions.getByRole('link', { name: /Download the JSON/ })
    ).toHaveAttribute('href', /workflow_templates/)
  })

  // A workflow that is one call to a model the catalogue carries is that
  // model with its graph around it, so the page runs rather than sending the
  // reader somewhere else.
  test('runs a partner workflow on its own page', async ({ page }) => {
    await page.goto('/hub/workflow/utility_nanobanana_pro_product_upscale/')

    await expect(page.getByTestId('workflow-run')).toBeVisible()
    await expect(page.getByTestId('workflow-destination')).toHaveCount(0)
  })

  // Most of the launch list loads weights or custom nodes, which Cloud holds
  // and the Router cannot. Those pages send the whole graph to Cloud from the
  // browser, so they open on a form of their own rather than on a way out.
  test('a Cloud workflow opens on the form that runs it', async ({ page }) => {
    await page.goto('/hub/workflow/flux_fill_inpaint_example/')

    await expect(page.getByTestId('workflow-on-cloud')).toBeVisible()
    await expect(page.getByTestId('workflow-run-input')).toBeVisible()
    await expect(page.getByTestId('workflow-run-result')).toBeVisible()
    // The model page's own shell is for the workflows that borrow it.
    await expect(page.getByTestId('workflow-run')).toHaveCount(0)
  })

  // The ways to take it elsewhere are a second question, so they wait behind
  // the tab that holds them rather than sitting under the form.
  test('keeps the ways out behind the details tab', async ({ page }) => {
    await page.goto('/hub/workflow/flux_fill_inpaint_example/')

    await expect(page.getByTestId('workflow-actions')).toHaveCount(0)

    await page.getByTestId('tab-details').click()

    await expect(
      page.getByTestId('workflow-actions').getByTestId('workflow-open-cloud')
    ).toBeVisible()
  })

  // Calling it yourself is offered on every workflow page, and the snippet is
  // built from that workflow's own bindings.
  test('builds a snippet from the workflow on the API tab', async ({
    page
  }) => {
    await page.goto('/hub/workflow/flux_fill_inpaint_example/')
    await page.getByTestId('tab-api').click()

    await expect(page.getByTestId('workflow-snippet')).toContainText(
      'flux_fill_inpaint_example.api.json'
    )
  })

  test('the prototype asks not to be indexed', async ({ request }) => {
    const response = await request.get(CATALOGUE)
    expect(response.ok()).toBe(true)
    expect(await response.text()).toContain('noindex')
  })
})
