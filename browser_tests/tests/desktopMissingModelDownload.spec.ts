import { expect } from '@playwright/test'

import { desktopModelDownloadFixture as test } from '@e2e/fixtures/desktopModelDownloadFixture'
import { cleanupFakeModel } from '@e2e/fixtures/helpers/ErrorsTabHelper'
import { TestIds } from '@e2e/fixtures/selectors'

test.describe('Desktop missing model download', { tag: '@desktop' }, () => {
  test.use({ initialSettings: { 'Comfy.RightSidePanel.ShowErrorsTab': true } })

  test.beforeEach(async ({ comfyPage }) => {
    await cleanupFakeModel(comfyPage)
  })

  test('downloads every missing model from the overlay and opens the errors tab', async ({
    comfyPage,
    modelDownloadHost
  }) => {
    await comfyPage.workflow.loadWorkflow('missing/missing_models')
    const overlay = comfyPage.page.getByTestId(TestIds.dialogs.errorOverlay)
    await expect(overlay).toBeVisible()

    await overlay.getByTestId(TestIds.dialogs.errorOverlayDownloadAll).click()

    await expect
      .poll(() => modelDownloadHost.downloads())
      .toEqual([
        {
          url: 'http://localhost:8188/api/devtools/fake_model.safetensors',
          filename: 'fake_model.safetensors',
          directory: 'checkpoints'
        }
      ])
    await expect(overlay).toBeHidden()
    await expect(
      comfyPage.page.getByTestId(TestIds.dialogs.missingModelsGroup)
    ).toBeVisible()
  })
})
