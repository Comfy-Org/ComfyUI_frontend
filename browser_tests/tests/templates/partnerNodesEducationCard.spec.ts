import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import { makeTemplate } from '@e2e/fixtures/data/templateFixtures'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import {
  createTemplateHelper,
  withTemplates
} from '@e2e/fixtures/helpers/TemplateHelper'
import { TestIds } from '@e2e/fixtures/selectors'

const PAID_TEMPLATE = 'paid-template'

async function mockPaidTemplate(page: Page) {
  await createTemplateHelper(
    page,
    withTemplates([
      makeTemplate({
        name: PAID_TEMPLATE,
        title: 'Paid Template',
        description: 'Uses partner nodes.',
        openSource: false
      })
    ])
  ).mock()

  // The paid template's workflow genuinely contains a partner node; the
  // card additionally gates on live graph content, not just the flag.
  await page.route(`**/templates/${PAID_TEMPLATE}.json`, (route) =>
    route.fulfill({
      status: 200,
      path: 'browser_tests/assets/partner_api_node.json',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    })
  )
}

async function loadPaidTemplate(comfyPage: ComfyPage) {
  await comfyPage.command.executeCommand('Comfy.BrowseTemplates')
  const card = comfyPage.page.getByTestId(
    TestIds.templates.workflowCard(PAID_TEMPLATE)
  )
  await expect(card).toBeVisible()
  await card.click()
}

// No @cloud tag on purpose: the card is local/desktop-only.
test.describe('Partner nodes education card (local)', () => {
  test('shows on paid template load, hides on graph switch, dismisses via Got it', async ({
    comfyPage
  }) => {
    const page = comfyPage.page
    await mockPaidTemplate(page)

    const card = page.getByTestId(TestIds.partnerNodes.educationCard)

    await loadPaidTemplate(comfyPage)
    await expect(card).toBeVisible()
    await expect(card).toContainText('This template uses partner nodes')

    // Switching to a graph without partner nodes hides the card without
    // requiring a dismissal — it must not outlive the template it describes.
    await comfyPage.workflow.loadWorkflow('default')
    await expect(card).toHaveCount(0)

    await loadPaidTemplate(comfyPage)
    await expect(card).toBeVisible()
    await page.getByTestId(TestIds.partnerNodes.educationCardDismiss).click()
    await expect(card).toHaveCount(0)

    // Dismissing carries no seen-flag: the next paid load shows it again.
    await loadPaidTemplate(comfyPage)
    await expect(card).toBeVisible()
    await page.getByTestId(TestIds.partnerNodes.educationCardGotIt).click()
    await expect(card).toHaveCount(0)
  })
})
