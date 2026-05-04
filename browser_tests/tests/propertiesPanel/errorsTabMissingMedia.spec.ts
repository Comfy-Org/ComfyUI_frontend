import { expect } from '@playwright/test'
import type { Route } from '@playwright/test'

import type { Asset, ListAssetsResponse } from '@comfyorg/ingest-types'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { STABLE_INPUT_IMAGE } from '@e2e/fixtures/data/assetFixtures'
import { TestIds } from '@e2e/fixtures/selectors'
import {
  loadWorkflowAndOpenErrorsTab,
  openErrorsTab
} from '@e2e/fixtures/helpers/ErrorsTabHelper'

const test = comfyPageFixture
const PUBLIC_INPUT_ASSET_HASH = 'nonexistent_test_image_12345.png'
const PUBLIC_INPUT_ASSET: Asset = {
  ...STABLE_INPUT_IMAGE,
  id: 'test-public-input-001',
  name: 'public_reference_photo.png',
  asset_hash: PUBLIC_INPUT_ASSET_HASH
}

function makeAssetsResponse(assets: Asset[]): ListAssetsResponse {
  return { assets, total: assets.length, has_more: false }
}

const cloudTest = comfyPageFixture.extend<{
  cloudAssetRequests: string[]
  stubCloudAssets: void
}>({
  cloudAssetRequests: async ({ page: _page }, use) => {
    await use([])
  },
  stubCloudAssets: [
    async ({ cloudAssetRequests, page }, use) => {
      const assetsRoutePattern = /\/api\/assets(?:\?.*)?$/
      const assetsRouteHandler = (route: Route) => {
        const url = new URL(route.request().url())
        const includeTags = url.searchParams.get('include_tags') ?? ''
        const tags = includeTags.split(',').filter(Boolean)
        const includePublic = url.searchParams.get('include_public') === 'true'
        const assets =
          tags.includes('input') && includePublic ? [PUBLIC_INPUT_ASSET] : []

        cloudAssetRequests.push(route.request().url())
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(makeAssetsResponse(assets))
        })
      }

      await page.route(assetsRoutePattern, assetsRouteHandler)
      await use()
      await page.unroute(assetsRoutePattern, assetsRouteHandler)
    },
    { auto: true }
  ]
})

async function uploadFileViaDropzone(comfyPage: ComfyPage) {
  const dropzone = comfyPage.page.getByTestId(
    TestIds.dialogs.missingMediaUploadDropzone
  )
  const [fileChooser] = await Promise.all([
    comfyPage.page.waitForEvent('filechooser'),
    dropzone.click()
  ])
  await fileChooser.setFiles(comfyPage.assetPath('test_upload_image.png'))
}

async function confirmPendingSelection(comfyPage: ComfyPage) {
  const confirmButton = comfyPage.page.getByTestId(
    TestIds.dialogs.missingMediaConfirmButton
  )
  await expect(confirmButton).toBeEnabled()
  await confirmButton.click()
}

function getMediaRow(comfyPage: ComfyPage) {
  return comfyPage.page.getByTestId(TestIds.dialogs.missingMediaRow)
}

function getStatusCard(comfyPage: ComfyPage) {
  return comfyPage.page.getByTestId(TestIds.dialogs.missingMediaStatusCard)
}

function getDropzone(comfyPage: ComfyPage) {
  return comfyPage.page.getByTestId(TestIds.dialogs.missingMediaUploadDropzone)
}

test.describe('Errors tab - Missing media', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting(
      'Comfy.RightSidePanel.ShowErrorsTab',
      true
    )
  })

  test.describe('Detection', () => {
    test('Shows missing media group in errors tab', async ({ comfyPage }) => {
      await loadWorkflowAndOpenErrorsTab(
        comfyPage,
        'missing/missing_media_single'
      )

      await expect(
        comfyPage.page.getByTestId(TestIds.dialogs.missingMediaGroup)
      ).toBeVisible()
    })

    test('Shows correct number of missing media rows', async ({
      comfyPage
    }) => {
      await loadWorkflowAndOpenErrorsTab(
        comfyPage,
        'missing/missing_media_multiple'
      )

      await expect(getMediaRow(comfyPage)).toHaveCount(2)
    })

    test('Shows upload dropzone and library select for each missing item', async ({
      comfyPage
    }) => {
      await loadWorkflowAndOpenErrorsTab(
        comfyPage,
        'missing/missing_media_single'
      )

      await expect(getDropzone(comfyPage)).toBeVisible()
      await expect(
        comfyPage.page.getByTestId(TestIds.dialogs.missingMediaLibrarySelect)
      ).toBeVisible()
    })
  })

  test.describe('Upload flow', () => {
    test('Upload via file picker shows status card then allows confirm', async ({
      comfyPage
    }) => {
      await loadWorkflowAndOpenErrorsTab(
        comfyPage,
        'missing/missing_media_single'
      )
      await uploadFileViaDropzone(comfyPage)

      await expect(getStatusCard(comfyPage)).toBeVisible()

      await confirmPendingSelection(comfyPage)
      await expect(getMediaRow(comfyPage)).toHaveCount(0)
    })
  })

  test.describe('Library select flow', () => {
    test('Selecting from library shows status card then allows confirm', async ({
      comfyPage
    }) => {
      await loadWorkflowAndOpenErrorsTab(
        comfyPage,
        'missing/missing_media_single'
      )

      const librarySelect = comfyPage.page.getByTestId(
        TestIds.dialogs.missingMediaLibrarySelect
      )
      await librarySelect.getByRole('combobox').click()

      const optionCount = await comfyPage.page.getByRole('option').count()
      if (optionCount === 0) {
        // oxlint-disable-next-line playwright/no-skipped-test -- no library options available in CI
        test.skip()
        return
      }

      await comfyPage.page.getByRole('option').first().click()

      await expect(getStatusCard(comfyPage)).toBeVisible()

      await confirmPendingSelection(comfyPage)
      await expect(getMediaRow(comfyPage)).toHaveCount(0)
    })
  })

  test.describe('Cancel selection', () => {
    test('Cancelling pending selection returns to upload/library UI', async ({
      comfyPage
    }) => {
      await loadWorkflowAndOpenErrorsTab(
        comfyPage,
        'missing/missing_media_single'
      )
      await uploadFileViaDropzone(comfyPage)

      await expect(getStatusCard(comfyPage)).toBeVisible()
      await expect(getDropzone(comfyPage)).toBeHidden()

      await comfyPage.page
        .getByTestId(TestIds.dialogs.missingMediaCancelButton)
        .click()

      await expect(getStatusCard(comfyPage)).toBeHidden()
      await expect(getDropzone(comfyPage)).toBeVisible()
    })
  })

  test.describe('All resolved', () => {
    test('Missing Inputs group disappears when all items are resolved', async ({
      comfyPage
    }) => {
      await loadWorkflowAndOpenErrorsTab(
        comfyPage,
        'missing/missing_media_single'
      )
      await uploadFileViaDropzone(comfyPage)
      await confirmPendingSelection(comfyPage)

      await expect(
        comfyPage.page.getByTestId(TestIds.dialogs.missingMediaGroup)
      ).toBeHidden()
    })
  })

  test.describe('Locate node', () => {
    test('Locate button navigates canvas to the missing media node', async ({
      comfyPage
    }) => {
      await loadWorkflowAndOpenErrorsTab(
        comfyPage,
        'missing/missing_media_single'
      )

      const offsetBefore = await comfyPage.page.evaluate(() => {
        const canvas = window['app']?.canvas
        return canvas?.ds?.offset
          ? [canvas.ds.offset[0], canvas.ds.offset[1]]
          : null
      })

      const locateButton = comfyPage.page.getByTestId(
        TestIds.dialogs.missingMediaLocateButton
      )
      await expect(locateButton).toBeVisible()
      await locateButton.click()

      await expect
        .poll(async () => {
          return await comfyPage.page.evaluate(() => {
            const canvas = window['app']?.canvas
            return canvas?.ds?.offset
              ? [canvas.ds.offset[0], canvas.ds.offset[1]]
              : null
          })
        })
        .not.toEqual(offsetBefore)
    })
  })
})

cloudTest.describe(
  'Errors tab - Missing media cloud assets',
  {
    tag: '@cloud'
  },
  () => {
    cloudTest.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting(
        'Comfy.RightSidePanel.ShowErrorsTab',
        true
      )
    })

    cloudTest(
      'does not report public input assets as missing',
      async ({ cloudAssetRequests, comfyPage }) => {
        await comfyPage.workflow.loadWorkflow('missing/missing_media_single')

        await expect
          .poll(() =>
            cloudAssetRequests.some((requestUrl) => {
              const url = new URL(requestUrl)
              const includeTags = url.searchParams.get('include_tags') ?? ''
              return (
                includeTags.split(',').includes('input') &&
                url.searchParams.get('include_public') === 'true'
              )
            })
          )
          .toBe(true)

        await openErrorsTab(comfyPage)

        await expect(
          comfyPage.page.getByTestId(TestIds.dialogs.missingMediaGroup)
        ).toBeHidden()
      }
    )
  }
)
