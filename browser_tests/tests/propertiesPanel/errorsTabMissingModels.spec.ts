import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import {
  interceptClipboardWrite,
  getClipboardText
} from '@e2e/helpers/clipboardSpy'
import { openErrorsTabViaSeeErrors } from '@e2e/tests/propertiesPanel/ErrorsTabHelper'

test.describe('Errors tab - Missing models', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting(
      'Comfy.RightSidePanel.ShowErrorsTab',
      true
    )
    await expect
      .poll(async () => {
        return await comfyPage.page.evaluate(async (url: string) => {
          const response = await fetch(`${url}/api/devtools/cleanup_fake_model`)
          return response.ok
        }, comfyPage.url)
      })
      .toBeTruthy()
  })

  test('Should show missing models group in errors tab', async ({
    comfyPage
  }) => {
    await openErrorsTabViaSeeErrors(comfyPage, 'missing/missing_models')

    await expect(
      comfyPage.page.getByTestId(TestIds.dialogs.missingModelsGroup)
    ).toBeVisible()
  })

  test('Should display model name with referencing node count', async ({
    comfyPage
  }) => {
    await openErrorsTabViaSeeErrors(comfyPage, 'missing/missing_models')

    const modelsGroup = comfyPage.page.getByTestId(
      TestIds.dialogs.missingModelsGroup
    )
    await expect(modelsGroup).toContainText(/fake_model\.safetensors\s*\(\d+\)/)
  })

  test('Should expand model row to show referencing nodes', async ({
    comfyPage
  }) => {
    await openErrorsTabViaSeeErrors(
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
    await openErrorsTabViaSeeErrors(comfyPage, 'missing/missing_models')
    await interceptClipboardWrite(comfyPage.page)

    const copyButton = comfyPage.page.getByTestId(
      TestIds.dialogs.missingModelCopyName
    )
    await expect(copyButton.first()).toBeVisible()
    await copyButton.first().click()

    const copiedText = await getClipboardText(comfyPage.page)
    expect(copiedText).toContain('fake_model.safetensors')
  })

  test.describe('OSS-specific', { tag: '@oss' }, () => {
    test('Should show Copy URL button for non-asset models', async ({
      comfyPage
    }) => {
      await openErrorsTabViaSeeErrors(comfyPage, 'missing/missing_models')

      const copyUrlButton = comfyPage.page.getByTestId(
        TestIds.dialogs.missingModelCopyUrl
      )
      await expect(copyUrlButton.first()).toBeVisible()
    })

    test('Should show Download button for downloadable models', async ({
      comfyPage
    }) => {
      await openErrorsTabViaSeeErrors(comfyPage, 'missing/missing_models')

      const downloadButton = comfyPage.page.getByTestId(
        TestIds.dialogs.missingModelDownload
      )
      await expect(downloadButton.first()).toBeVisible()
    })
  })
})
