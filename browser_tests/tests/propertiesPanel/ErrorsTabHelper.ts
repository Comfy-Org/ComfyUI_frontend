import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import { PropertiesPanelHelper } from '@e2e/tests/propertiesPanel/PropertiesPanelHelper'

export async function openErrorsTabViaSeeErrors(
  comfyPage: ComfyPage,
  workflow: string
) {
  await comfyPage.workflow.loadWorkflow(workflow)

  const errorOverlay = comfyPage.page.getByTestId(TestIds.dialogs.errorOverlay)
  await expect(errorOverlay).toBeVisible()

  await errorOverlay.getByTestId(TestIds.dialogs.errorOverlaySeeErrors).click()
  await expect(errorOverlay).not.toBeVisible()
}

export async function openErrorsTab(comfyPage: ComfyPage) {
  const panel = new PropertiesPanelHelper(comfyPage.page)
  await panel.open(comfyPage.actionbar.propertiesButton)

  const errorsTab = comfyPage.page.getByTestId(
    TestIds.propertiesPanel.errorsTab
  )
  await expect(errorsTab).toBeVisible()
  await errorsTab.click()
}
