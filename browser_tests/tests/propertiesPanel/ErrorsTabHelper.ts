import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import { PropertiesPanelHelper } from '@e2e/tests/propertiesPanel/PropertiesPanelHelper'

export async function loadWorkflowAndOpenErrorsTab(
  comfyPage: ComfyPage,
  workflow: string
) {
  await comfyPage.workflow.loadWorkflow(workflow)

  const errorOverlay = comfyPage.page.getByTestId(TestIds.dialogs.errorOverlay)
  await expect(errorOverlay).toBeVisible()

  await errorOverlay.getByTestId(TestIds.dialogs.errorOverlaySeeErrors).click()
  await expect(errorOverlay).toBeHidden()
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

/**
 * Remove the fake model file from the backend so it is detected as missing.
 * Fixture URLs (e.g. http://localhost:8188/...) are not actually downloaded
 * during tests — they only serve as metadata for the missing model UI.
 */
export async function cleanupFakeModel(comfyPage: ComfyPage) {
  await expect
    .poll(() =>
      comfyPage.page.evaluate(async (url: string) => {
        const response = await fetch(`${url}/api/devtools/cleanup_fake_model`)
        return response.ok
      }, comfyPage.url)
    )
    .toBeTruthy()
}
