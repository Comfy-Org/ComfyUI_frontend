import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

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
