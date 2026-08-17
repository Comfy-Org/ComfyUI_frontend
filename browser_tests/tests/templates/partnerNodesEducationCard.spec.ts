import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import { makeTemplate } from '@e2e/fixtures/data/templateFixtures'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import type { TemplateHelper } from '@e2e/fixtures/helpers/TemplateHelper'
import {
  createTemplateHelper,
  withTemplates
} from '@e2e/fixtures/helpers/TemplateHelper'
import { TestIds } from '@e2e/fixtures/selectors'

const PAID_TEMPLATE = 'paid-template'

async function mockPaidTemplate(page: Page): Promise<TemplateHelper> {
  const templates = createTemplateHelper(
    page,
    withTemplates([
      makeTemplate({
        name: PAID_TEMPLATE,
        title: 'Paid Template',
        description: 'Uses partner nodes.',
        openSource: false
      })
    ])
  )
  await templates.mock()
  // The paid template's workflow genuinely contains a partner node; the
  // card additionally gates on live graph content, not just the flag.
  await templates.mockWorkflow(
    PAID_TEMPLATE,
    'browser_tests/assets/partner_api_node.json'
  )
  return templates
}

test.describe('Partner nodes education card (local)', () => {
  test('shows on paid template load, hides on graph switch, dismisses via Got it', async ({
    comfyPage
  }) => {
    const page = comfyPage.page
    const templates = await mockPaidTemplate(page)

    const card = page.getByTestId(TestIds.partnerNodes.educationCard)

    await templates.load(PAID_TEMPLATE)
    await expect(card).toBeVisible()
    await expect(card).toContainText('This template uses partner nodes')

    // Switching to a graph without partner nodes hides the card without
    // requiring a dismissal — it must not outlive the template it describes.
    await comfyPage.workflow.loadWorkflow('default')
    await expect(card).toHaveCount(0)

    await templates.load(PAID_TEMPLATE)
    await expect(card).toBeVisible()
    await page.getByTestId(TestIds.partnerNodes.educationCardDismiss).click()
    await expect(card).toHaveCount(0)

    // Dismissing carries no seen-flag: the next paid load shows it again.
    await templates.load(PAID_TEMPLATE)
    await expect(card).toBeVisible()
    await page.getByTestId(TestIds.partnerNodes.educationCardGotIt).click()
    await expect(card).toHaveCount(0)
  })
})
