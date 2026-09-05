import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { mockPaidTemplate } from '@e2e/fixtures/helpers/TemplateHelper'
import { TestIds } from '@e2e/fixtures/selectors'

const PAID_TEMPLATE = 'paid-template'
const PARTNER_WORKFLOW = 'browser_tests/assets/partner_api_node.json'

test.describe('Partner nodes education card (local)', () => {
  test('shows on paid template load, hides on graph switch, re-shows without a seen-flag', async ({
    comfyPage
  }) => {
    const page = comfyPage.page
    const templates = await mockPaidTemplate(
      page,
      PAID_TEMPLATE,
      PARTNER_WORKFLOW
    )

    const card = page.getByTestId(TestIds.partnerNodes.educationCard)

    await templates.load(PAID_TEMPLATE)
    await expect(card).toBeVisible()
    await expect(card).toContainText('See the difference? Drag to compare.')

    // Leaving the graph retires the card — it must not describe a workflow the
    // user has left.
    await comfyPage.workflow.loadWorkflow('default')
    await expect(card).toHaveCount(0)

    await templates.load(PAID_TEMPLATE)
    await expect(card).toBeVisible()
    await page.getByTestId(TestIds.partnerNodes.educationCardDismiss).click()
    await expect(card).toHaveCount(0)

    // No seen-flag: the next paid load shows it again.
    await templates.load(PAID_TEMPLATE)
    await expect(card).toBeVisible()
  })
})
