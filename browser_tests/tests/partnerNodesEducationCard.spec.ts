import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

async function mockTemplateIndex(page: Page) {
  await page.route('**/templates/index.json', (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify([
        {
          moduleName: 'default',
          title: 'Test Templates',
          type: 'image',
          templates: [
            {
              name: 'paid-template',
              title: 'Paid Template',
              mediaType: 'image',
              mediaSubtype: 'webp',
              description: 'Uses partner nodes.',
              openSource: false
            }
          ]
        }
      ]),
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    })
  )
  await page.route('**/templates/**.webp', (route) =>
    route.fulfill({
      status: 200,
      path: 'browser_tests/assets/example.webp',
      headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'no-store' }
    })
  )
  // The paid template's workflow genuinely contains a partner node; the
  // card additionally gates on live graph content, not just the flag.
  await page.route('**/templates/paid-template.json', (route) =>
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
    TestIds.templates.workflowCard('paid-template')
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
    await mockTemplateIndex(page)

    const card = page.getByTestId(TestIds.partnerNodes.educationCard)

    await loadPaidTemplate(comfyPage)
    await expect(card).toBeVisible()
    await expect(card).toContainText('This template uses partner nodes')

    // Switching to a graph without partner nodes hides the card without
    // requiring a dismissal — it must not outlive the template it describes.
    await comfyPage.workflow.loadWorkflow('default')
    await expect(card).toHaveCount(0)

    // A later paid-template load shows it again (no seen-flag persistence),
    // and Got it dismisses it.
    await loadPaidTemplate(comfyPage)
    await expect(card).toBeVisible()
    await page.getByTestId(TestIds.partnerNodes.educationCardGotIt).click()
    await expect(card).toHaveCount(0)
  })
})
