import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import {
  interceptClipboardWrite,
  getClipboardText
} from '@e2e/helpers/clipboardSpy'
import {
  cleanupFakeModel,
  loadWorkflowAndOpenErrorsTab
} from '@e2e/tests/propertiesPanel/ErrorsTabHelper'

test.describe('Errors tab - Missing models', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting(
      'Comfy.RightSidePanel.ShowErrorsTab',
      true
    )
    await cleanupFakeModel(comfyPage)
  })

  test('Should show missing models group in errors tab', async ({
    comfyPage
  }) => {
    await loadWorkflowAndOpenErrorsTab(comfyPage, 'missing/missing_models')

    await expect(
      comfyPage.page.getByTestId(TestIds.dialogs.missingModelsGroup)
    ).toBeVisible()
  })

  test('Should display model name with referencing node count', async ({
    comfyPage
  }) => {
    await loadWorkflowAndOpenErrorsTab(comfyPage, 'missing/missing_models')

    const modelsGroup = comfyPage.page.getByTestId(
      TestIds.dialogs.missingModelsGroup
    )
    await expect(modelsGroup).toContainText(/fake_model\.safetensors\s*\(\d+\)/)
  })

  test('Should expand model row to show referencing nodes', async ({
    comfyPage
  }) => {
    await loadWorkflowAndOpenErrorsTab(
      comfyPage,
      'missing/missing_models_with_nodes'
    )

    const locateButton = comfyPage.page.getByTestId(
      TestIds.dialogs.missingModelLocate
    )
    await expect(locateButton.first()).toBeHidden()

    const expandButton = comfyPage.page.getByTestId(
      TestIds.dialogs.missingModelExpand
    )
    await expect(expandButton.first()).toBeVisible()
    await expandButton.first().click()

    await expect(locateButton.first()).toBeVisible()
  })

  test('Should copy model name to clipboard', async ({ comfyPage }) => {
    await loadWorkflowAndOpenErrorsTab(comfyPage, 'missing/missing_models')
    await interceptClipboardWrite(comfyPage.page)

    const copyButton = comfyPage.page.getByTestId(
      TestIds.dialogs.missingModelCopyName
    )
    await expect(copyButton.first()).toBeVisible()
    await copyButton.first().dispatchEvent('click')

    const copiedText = await getClipboardText(comfyPage.page)
    expect(copiedText).toContain('fake_model.safetensors')
  })

  test.describe('OSS-specific', { tag: '@oss' }, () => {
    test('Should show Copy URL button for non-asset models', async ({
      comfyPage
    }) => {
      await loadWorkflowAndOpenErrorsTab(comfyPage, 'missing/missing_models')

      const copyUrlButton = comfyPage.page.getByTestId(
        TestIds.dialogs.missingModelCopyUrl
      )
      await expect(copyUrlButton.first()).toBeVisible()
    })

    test('Should show Download button for downloadable models', async ({
      comfyPage
    }) => {
      await loadWorkflowAndOpenErrorsTab(comfyPage, 'missing/missing_models')

      const downloadButton = comfyPage.page.getByTestId(
        TestIds.dialogs.missingModelDownload
      )
      await expect(downloadButton.first()).toBeVisible()
    })

    test('Should render Download all and Refresh actions for one downloadable model', async ({
      comfyPage
    }) => {
      await loadWorkflowAndOpenErrorsTab(comfyPage, 'missing/missing_models')

      await expect(
        comfyPage.page.getByTestId(TestIds.dialogs.missingModelActions)
      ).toBeVisible()
      await expect(
        comfyPage.page.getByTestId(TestIds.dialogs.missingModelDownloadAll)
      ).toBeVisible()
      await expect(
        comfyPage.page.getByTestId(TestIds.dialogs.missingModelRefresh)
      ).toBeVisible()
    })

    test('Should clear resolved missing model when Refresh is clicked', async ({
      comfyPage
    }) => {
      await loadWorkflowAndOpenErrorsTab(comfyPage, 'missing/missing_models')
      await comfyPage.page.route(/\/object_info$/, async (route) => {
        const response = await route.fetch()
        const objectInfo = await response.json()
        const ckptName =
          objectInfo.CheckpointLoaderSimple.input.required.ckpt_name
        ckptName[0] = [...ckptName[0], 'fake_model.safetensors']
        await route.fulfill({ response, json: objectInfo })
      })

      const objectInfoResponse = comfyPage.page.waitForResponse((response) => {
        const url = new URL(response.url())
        return url.pathname.endsWith('/object_info') && response.ok()
      })
      const modelFoldersResponse = comfyPage.page.waitForResponse(
        (response) => {
          const url = new URL(response.url())
          return url.pathname.endsWith('/experiment/models') && response.ok()
        }
      )
      const refreshButton = comfyPage.page.getByTestId(
        TestIds.dialogs.missingModelRefresh
      )

      await Promise.all([
        objectInfoResponse,
        modelFoldersResponse,
        refreshButton.click()
      ])
      await expect(
        comfyPage.page.getByTestId(TestIds.dialogs.missingModelsGroup)
      ).toBeHidden()
    })
  })
})
