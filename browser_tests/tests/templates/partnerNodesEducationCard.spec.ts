import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import type { TemplateHelper } from '@e2e/fixtures/helpers/TemplateHelper'
import { mockPaidTemplate } from '@e2e/fixtures/helpers/TemplateHelper'
import { TestIds } from '@e2e/fixtures/selectors'

const PAID_TEMPLATE = 'paid-template'
const PARTNER_WORKFLOW = 'browser_tests/assets/partner_api_node.json'

async function loadPaidTemplateFromDefault(
  comfyPage: ComfyPage,
  templates: TemplateHelper
) {
  await comfyPage.workflow.loadWorkflow('default')
  await templates.load(PAID_TEMPLATE)
  await expect
    .poll(() => comfyPage.workflow.getActiveWorkflowPath())
    .toContain(PAID_TEMPLATE)
  await comfyPage.nextFrame()
}

test.describe('Partner nodes education card (local)', () => {
  test('retires on graph switch and shows again on the next paid load', async ({
    comfyPage
  }) => {
    const templates = await mockPaidTemplate(
      comfyPage.page,
      PAID_TEMPLATE,
      PARTNER_WORKFLOW
    )
    const card = comfyPage.page.getByTestId(TestIds.partnerNodes.educationCard)

    await templates.load(PAID_TEMPLATE)
    await expect(card).toBeVisible()
    await expect(card).toContainText('See the difference? Drag to compare.')

    await comfyPage.workflow.loadWorkflow('default')
    await expect(card).toHaveCount(0)

    await templates.load(PAID_TEMPLATE)
    await expect(card).toBeVisible()
  })

  test('stays closed after the user dismisses it, including after reload', async ({
    comfyPage
  }) => {
    const templates = await mockPaidTemplate(
      comfyPage.page,
      PAID_TEMPLATE,
      PARTNER_WORKFLOW
    )
    const card = comfyPage.page.getByTestId(TestIds.partnerNodes.educationCard)

    await templates.load(PAID_TEMPLATE)
    await expect(card).toBeVisible()
    await comfyPage.page
      .getByTestId(TestIds.partnerNodes.educationCardDismiss)
      .click()
    await expect(card).toHaveCount(0)

    await loadPaidTemplateFromDefault(comfyPage, templates)
    await expect(card).toHaveCount(0)

    await comfyPage.workflow.reloadAndWaitForApp()
    await loadPaidTemplateFromDefault(comfyPage, templates)
    await expect(card).toHaveCount(0)
  })
})
