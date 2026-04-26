import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { loadTemplateIntoGraph } from '@e2e/fixtures/helpers/apiNodesTemplateHelper'

/**
 * Coverage for the actionbar cost indicator: appears when the current
 * workflow has priced api-nodes, disappears when it doesn't, and the
 * popover reveal renders the same breakdown the sign-in dialog uses.
 */

const TEMPLATE_WITH_API_NODES = 'templates-all_in_one-image_edit_models'

test.describe('API Nodes cost indicator', { tag: ['@ui', '@slow'] }, () => {
  test('hidden when the workflow has no api-nodes', async ({ comfyPage }) => {
    await loadTemplateIntoGraph(comfyPage.page, 'default')
    await expect(
      comfyPage.page.getByTestId('api-nodes-cost-indicator')
    ).toBeHidden()
  })

  test('visible with total when the workflow has priced api-nodes', async ({
    comfyPage
  }) => {
    await loadTemplateIntoGraph(comfyPage.page, TEMPLATE_WITH_API_NODES)
    const indicator = comfyPage.page.getByTestId('api-nodes-cost-indicator')
    await expect(indicator).toBeVisible()
    // Visible chip drops the unit — compact range with optional `~` (range)
    // and `+` (unpriced nodes present) sigils. The "credits" word lives in
    // the accessible name, asserted separately so a copy change to either
    // surface fails this test loudly instead of silently.
    await expect(indicator).toHaveText(/^[~]?[\d.]+(?:-[\d.]+)?[+]?$/)
    await expect(
      comfyPage.page.getByRole('button', {
        name: /Estimated API run cost: .* credits/i
      })
    ).toBeVisible()
  })

  test('disappears after swapping to a no-api-node workflow', async ({
    comfyPage
  }) => {
    await loadTemplateIntoGraph(comfyPage.page, TEMPLATE_WITH_API_NODES)
    const indicator = comfyPage.page.getByTestId('api-nodes-cost-indicator')
    await expect(indicator).toBeVisible()

    await loadTemplateIntoGraph(comfyPage.page, 'default')
    await expect(indicator).toBeHidden()
  })

  test('clicking the indicator opens a breakdown popover', async ({
    comfyPage
  }) => {
    const apiNodeCount = await loadTemplateIntoGraph(
      comfyPage.page,
      TEMPLATE_WITH_API_NODES
    )

    const indicator = comfyPage.page.getByTestId('api-nodes-cost-indicator')
    await indicator.click()

    const popover = comfyPage.page.getByTestId('api-nodes-cost-popover')
    await expect(popover).toBeVisible()
    // Popover uses ApiNodesList so the data-testid from the list row applies
    // here too — one more bit of evidence the two surfaces share the same
    // presentational component. Row count comes from the live graph so a
    // catalog change doesn't drift the test away from ground truth.
    await expect(popover.getByTestId('api-node-row')).toHaveCount(
      apiNodeCount,
      { timeout: 5000 }
    )
    await expect(popover.getByText('Total Cost')).toBeVisible()

    // Guard against the ScrollPanel-collapse bug: rows can be in the DOM but
    // clipped to 0 height when the popover parent has no definite flex budget
    // for `h-0 grow` to expand into. Assert both that the last row's bottom
    // sits inside the popover's bounding box AND that a row has positive
    // rendered height — either check alone would let a silently-collapsed
    // row area pass.
    const firstRow = popover.getByTestId('api-node-row').first()
    const lastRow = popover.getByTestId('api-node-row').last()
    const popBox = await popover.boundingBox()
    const firstRowBox = await firstRow.boundingBox()
    const lastRowBox = await lastRow.boundingBox()
    expect(popBox).not.toBeNull()
    expect(firstRowBox).not.toBeNull()
    expect(lastRowBox).not.toBeNull()
    expect(firstRowBox!.height).toBeGreaterThan(0)
    // +1px tolerance for sub-pixel rounding on high-DPI displays /
    // zoom levels. getBoundingClientRect returns fractional CSS pixels
    // and a visually-contained row can round half a pixel over the
    // container boundary, failing a strict containment check.
    expect(lastRowBox!.y + lastRowBox!.height).toBeLessThanOrEqual(
      popBox!.y + popBox!.height + 1
    )

    // Escape closes the popover. Guards against a Reka version bump
    // breaking dismiss-on-Escape and silently leaving focus trapped.
    await comfyPage.page.keyboard.press('Escape')
    await expect(popover).toBeHidden()
  })
})
