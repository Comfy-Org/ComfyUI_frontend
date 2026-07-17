import { expect } from '@playwright/test'
import type { Locator } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import {
  interceptClipboardWrite,
  getClipboardText
} from '@e2e/fixtures/utils/clipboardSpy'
import {
  cleanupFakeModel,
  loadWorkflowAndOpenErrorsTab
} from '@e2e/fixtures/helpers/ErrorsTabHelper'

const FAKE_MODEL_NAME = 'fake_model.safetensors'
const GATED_MODEL_REPO_URL = 'https://huggingface.co/comfy-e2e/gated-test'
const UNSUPPORTED_MODEL_NAME = 'gated_model.bin'

function getModelLabel(group: Locator, modelName: string = FAKE_MODEL_NAME) {
  return group.getByRole('button', { name: modelName, exact: true })
}

async function expectReferenceBadge(group: Locator, count: number) {
  await expect(
    group.getByTestId(TestIds.dialogs.missingModelReferenceCount)
  ).toHaveText(String(count))
}

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

    const missingModelsGroup = comfyPage.page.getByTestId(
      TestIds.dialogs.missingModelsGroup
    )
    await expect(missingModelsGroup).toBeVisible()
    await expect(
      missingModelsGroup.getByTestId(TestIds.dialogs.errorGroupDisplayMessage)
    ).toHaveText(/\S/)
  })

  test('Should display model name and metadata', async ({ comfyPage }) => {
    await loadWorkflowAndOpenErrorsTab(comfyPage, 'missing/missing_models')

    const modelsGroup = comfyPage.page.getByTestId(
      TestIds.dialogs.missingModelsGroup
    )
    await expect(getModelLabel(modelsGroup)).toBeVisible()
    await expect(modelsGroup.getByText('checkpoints')).toBeVisible()
  })

  test('Should expand model row to show referencing nodes', async ({
    comfyPage
  }) => {
    await loadWorkflowAndOpenErrorsTab(
      comfyPage,
      'missing/missing_models_with_nodes'
    )

    const modelsGroup = comfyPage.page.getByTestId(
      TestIds.dialogs.missingModelsGroup
    )
    const expandButton = modelsGroup.getByTestId(
      TestIds.dialogs.missingModelExpand
    )
    await expect(expandButton.first()).toBeVisible()
    await expectReferenceBadge(modelsGroup, 2)
    await expandButton.first().click()

    await expect(
      modelsGroup.getByTestId(TestIds.dialogs.missingModelLocate)
    ).toHaveCount(2)
  })

  test('Should copy model URL to clipboard', async ({ comfyPage }) => {
    await loadWorkflowAndOpenErrorsTab(comfyPage, 'missing/missing_models')
    await interceptClipboardWrite(comfyPage.page)

    const copyButton = comfyPage.page.getByRole('button', {
      name: 'Copy URL'
    })
    await expect(copyButton.first()).toBeVisible()
    await copyButton.first().dispatchEvent('click')

    const copiedText = await getClipboardText(comfyPage.page)
    expect(copiedText).toContain('/api/devtools/')
  })

  test.describe('OSS-specific', { tag: '@oss' }, () => {
    test('Should show Copy URL button for non-asset models', async ({
      comfyPage
    }) => {
      await loadWorkflowAndOpenErrorsTab(comfyPage, 'missing/missing_models')

      const copyUrlButton = comfyPage.page.getByRole('button', {
        name: 'Copy URL'
      })
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
      await expect(downloadButton.first()).toHaveText('Download')
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
        ckptName[0] = [...ckptName[0], FAKE_MODEL_NAME]
        await route.fulfill({ response, json: objectInfo })
      })

      const objectInfoResponse = comfyPage.page.waitForResponse((response) => {
        const url = new URL(response.url())
        return url.pathname.endsWith('/object_info') && response.ok()
      })
      const refreshButton = comfyPage.page.getByTestId(
        TestIds.dialogs.missingModelRefresh
      )

      await Promise.all([objectInfoResponse, refreshButton.click()])
      await expect(
        comfyPage.page.getByTestId(TestIds.dialogs.missingModelsGroup)
      ).toBeHidden()
    })

    test.describe('Gated Hugging Face model', { tag: '@ui' }, () => {
      test.beforeEach(async ({ comfyPage }) => {
        await comfyPage.page
          .context()
          .route('https://huggingface.co/**', async (route) => {
            if (route.request().method() === 'HEAD') {
              return route.fulfill({
                status: 403,
                headers: { 'Access-Control-Allow-Origin': '*' }
              })
            }

            return route.fulfill({
              status: 200,
              contentType: 'text/html',
              body: '<html><body>stub repo page</body></html>'
            })
          })
        await loadWorkflowAndOpenErrorsTab(
          comfyPage,
          'missing/missing_models_gated'
        )
      })

      test('Should classify a 403 model as gated', async ({ comfyPage }) => {
        await expect(
          comfyPage.page.getByTestId(TestIds.dialogs.missingModelGatedAccess)
        ).toBeVisible()
        await expect(
          comfyPage.page.getByTestId(TestIds.dialogs.missingModelGatedHint)
        ).toBeVisible()
      })

      test('Should keep Download available for a gated model', async ({
        comfyPage
      }) => {
        await expect(
          comfyPage.page.getByTestId(TestIds.dialogs.missingModelGatedAccess)
        ).toBeVisible()

        const downloadButton = comfyPage.page.getByTestId(
          TestIds.dialogs.missingModelDownload
        )

        await expect(downloadButton).toBeVisible()
        await expect(downloadButton).toBeEnabled()
        await expect(downloadButton).toHaveText('Download')
      })

      test('Should open the gated repository with the browser fallback', async ({
        comfyPage
      }) => {
        const pagePromise = comfyPage.page.context().waitForEvent('page')
        await comfyPage.page
          .getByTestId(TestIds.dialogs.missingModelGatedAccess)
          .click()
        const accessPage = await pagePromise

        expect(accessPage.url()).toBe(GATED_MODEL_REPO_URL)
      })
    })

    test.describe('Gated model with an unsupported extension', () => {
      test('Should not show gated guidance when no row can act on it', async ({
        comfyPage
      }) => {
        let gatedHeadRequests = 0
        await comfyPage.page
          .context()
          .route('https://huggingface.co/**', async (route) => {
            if (route.request().method() !== 'HEAD') return route.abort()

            gatedHeadRequests += 1
            return route.fulfill({
              status: 403,
              headers: { 'Access-Control-Allow-Origin': '*' }
            })
          })
        await loadWorkflowAndOpenErrorsTab(
          comfyPage,
          'missing/missing_models_gated_unsupported'
        )

        const modelsGroup = comfyPage.page.getByTestId(
          TestIds.dialogs.missingModelsGroup
        )
        await expect(
          getModelLabel(modelsGroup, UNSUPPORTED_MODEL_NAME)
        ).toBeVisible()

        // The pipeline HEADs any candidate with a url and directory, so the
        // gated response lands before the extension is ever considered.
        await expect.poll(() => gatedHeadRequests).toBeGreaterThan(0)

        await expect(
          comfyPage.page.getByTestId(TestIds.dialogs.missingModelDownload)
        ).toHaveCount(0)
        await expect(
          comfyPage.page.getByTestId(TestIds.dialogs.missingModelGatedAccess)
        ).toHaveCount(0)
        await expect(
          comfyPage.page.getByTestId(TestIds.dialogs.missingModelGatedHint)
        ).toHaveCount(0)
      })
    })
  })
})
