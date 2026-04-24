import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { ApiSignin } from '@e2e/fixtures/components/ApiSignin'
import { loadTemplateIntoGraph } from '@e2e/fixtures/helpers/apiNodesTemplateHelper'

/**
 * Regression harness for the sign-in dialog's cost breakdown across real
 * templates in the catalog. The 2026-04-23 template audit
 * (temp/scripts/auditApiNodeTemplates.js) found 24 templates with >= 3
 * api-nodes, including a 12-row outlier, all of which previously triggered
 * a silent ScrollPanel collapse that made the dialog's total read as
 * disconnected from the visible rows. This spec picks representative
 * templates across that distribution and asserts the list-count invariant.
 */

type TemplateFixture = {
  name: string
  expectedApiCount: number
}

const FIXTURES: TemplateFixture[] = [
  { name: 'templates-all_in_one-image_edit_models', expectedApiCount: 4 },
  { name: 'api_tripo3_0_text_to_model', expectedApiCount: 6 },
  { name: 'templates-1_input-multiple_styles_prompt.app', expectedApiCount: 12 }
]

test.describe(
  'API Nodes sign-in dialog — template regression',
  { tag: ['@ui', '@slow'] },
  () => {
    let dialog: ApiSignin

    // Cancel resolves the showApiNodesSignInDialog promise that
    // ApiSignin.open() leaves unawaited, so the context can close cleanly.
    test.afterEach(async () => {
      if (dialog && (await dialog.root.isVisible())) {
        await dialog.cancel.click()
        await expect(dialog.root).toBeHidden()
      }
    })

    for (const { name, expectedApiCount } of FIXTURES) {
      test(`renders all ${expectedApiCount} api-nodes for ${name}`, async ({
        comfyPage
      }) => {
        const actualApiCount = await loadTemplateIntoGraph(comfyPage.page, name)

        // Drift check with a clear label: a template catalog change shows
        // up here with "catalog drift" in the message, not as a UI
        // regression further down. Doesn't abort the test — the UI
        // assertions below use `actualApiCount` as ground truth so they
        // keep validating the real invariant (rows match the graph) even
        // when the fixture's count falls behind the catalog.
        if (actualApiCount !== expectedApiCount) {
          test.info().annotations.push({
            type: 'catalog-drift',
            description: `template "${name}" now has ${actualApiCount} api-nodes; fixture says ${expectedApiCount}. Update FIXTURES — this is a fixture audit, not a UI regression.`
          })
        }

        dialog = new ApiSignin(comfyPage.page)
        await dialog.open([])

        // Pricing evaluation is async (JSONata). Poll until the list
        // settles at the count the graph actually has, then freeze the
        // assertions. Using `actualApiCount` rather than the fixture
        // constant means a template that gained or lost an api-node
        // doesn't surface as a false UI regression here.
        await expect(dialog.rows).toHaveCount(actualApiCount, {
          timeout: 5000
        })
        await expect(dialog.costBreakdownTitle).toContainText(
          `(${actualApiCount})`
        )
        await expect(dialog.totalCostLabel).toBeVisible()

        // Guard against layout regressions where rows overflow the dialog box
        // and push the Total Cost / buttons off-screen. toBeVisible() only
        // asserts non-zero size; it doesn't confirm the element sits inside a
        // visible ancestor region. Compare bounding boxes directly.
        const dialogBox = await dialog.root.boundingBox()
        const totalBox = await dialog.totalCostLabel.boundingBox()
        expect(dialogBox).not.toBeNull()
        expect(totalBox).not.toBeNull()
        expect(totalBox!.y + totalBox!.height).toBeLessThanOrEqual(
          dialogBox!.y + dialogBox!.height
        )
      })
    }
  }
)
