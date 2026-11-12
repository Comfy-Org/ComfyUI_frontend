import { expect } from '@playwright/test'

import { desktopModelDownloadFixture as test } from '@e2e/fixtures/desktopModelDownloadFixture'
import {
  cleanupFakeModel,
  loadWorkflowAndOpenErrorsTab
} from '@e2e/fixtures/helpers/ErrorsTabHelper'
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

  test('shows download progress on the missing model row until it completes', async ({
    comfyPage,
    modelDownloadHost
  }) => {
    const fakeModel = {
      id: 'job-1',
      url: 'http://localhost:8188/api/devtools/fake_model.safetensors',
      filename: 'fake_model.safetensors',
      directory: 'checkpoints',
      progress: 0
    }
    await comfyPage.workflow.loadWorkflow('missing/missing_models')
    await comfyPage.page
      .getByTestId(TestIds.dialogs.errorOverlay)
      .getByTestId(TestIds.dialogs.errorOverlayDownloadAll)
      .click()
    const group = comfyPage.page.getByTestId(TestIds.dialogs.missingModelsGroup)

    await test.step('progress replaces the Download button', async () => {
      await modelDownloadHost.emitProgress({ ...fakeModel, status: 'pending' })
      await modelDownloadHost.emitProgress({
        ...fakeModel,
        status: 'downloading',
        progress: 0.5,
        receivedBytes: 512 * 1024 * 1024,
        totalBytes: 1024 * 1024 * 1024
      })

      await expect(
        group.getByRole('progressbar', {
          name: 'Downloading fake_model.safetensors'
        })
      ).toHaveAttribute('aria-valuetext', '512 MB / 1 GB')
      await expect(
        group.getByTestId(TestIds.dialogs.missingModelDownload)
      ).toBeHidden()
    })

    await test.step('completion re-checks and offers the download again while the file is still missing', async () => {
      await modelDownloadHost.emitProgress({
        ...fakeModel,
        status: 'completed',
        progress: 1
      })

      await expect(
        group.getByTestId(TestIds.dialogs.missingModelDownload)
      ).toBeVisible()
      await expect(group.getByRole('progressbar')).toBeHidden()
    })
  })

  test('shows a download started outside the errors tab', async ({
    comfyPage,
    modelDownloadHost
  }) => {
    await loadWorkflowAndOpenErrorsTab(comfyPage, 'missing/missing_models')
    const group = comfyPage.page.getByTestId(TestIds.dialogs.missingModelsGroup)
    await expect(
      group.getByTestId(TestIds.dialogs.missingModelDownload)
    ).toBeVisible()

    await modelDownloadHost.emitProgress({
      id: 'template-job',
      url: 'http://localhost:8188/api/devtools/fake_model.safetensors',
      filename: 'fake_model.safetensors',
      directory: 'checkpoints',
      status: 'downloading',
      progress: 0.25,
      receivedBytes: 256 * 1024 * 1024,
      totalBytes: 1024 * 1024 * 1024
    })

    await expect(
      group.getByRole('progressbar', {
        name: 'Downloading fake_model.safetensors'
      })
    ).toHaveAttribute('aria-valuenow', '25')
    expect(await modelDownloadHost.downloads()).toEqual([])
  })
})
