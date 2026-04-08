import { expect } from '@playwright/test'

import type { ComfyPage } from '../../fixtures/ComfyPage'
import { TestIds } from '../../fixtures/selectors'

export async function openErrorsTabViaSeeErrors(
  comfyPage: ComfyPage,
  workflow: string
) {
  await comfyPage.workflow.loadWorkflow(workflow)

  const errorOverlay = comfyPage.page.getByTestId(TestIds.dialogs.errorOverlay)
  await expect(errorOverlay).toBeVisible()

  await expect(
    errorOverlay.getByTestId(TestIds.dialogs.errorOverlaySeeErrors)
  ).toBeVisible()
  await errorOverlay.getByTestId(TestIds.dialogs.errorOverlaySeeErrors).click()
  await expect(errorOverlay).not.toBeVisible()
}
