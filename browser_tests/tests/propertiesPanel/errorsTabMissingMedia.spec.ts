import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import { loadWorkflowAndOpenErrorsTab } from '@e2e/fixtures/helpers/ErrorsTabHelper'

function getMediaRow(comfyPage: ComfyPage) {
  return comfyPage.page.getByTestId(TestIds.dialogs.missingMediaRow)
}

function getErrorOverlay(comfyPage: ComfyPage) {
  return comfyPage.page.getByTestId(TestIds.dialogs.errorOverlay)
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
      await comfyPage.workflow.loadWorkflow('missing/missing_media_single')

      const overlay = getErrorOverlay(comfyPage)
      await expect(overlay).toBeVisible()
      await expect(
        overlay.getByTestId(TestIds.dialogs.errorOverlayMessages)
      ).toContainText(/Load Image/)

      await overlay.getByTestId(TestIds.dialogs.errorOverlaySeeErrors).click()
      await expect(overlay).toBeHidden()

      const missingMediaGroup = comfyPage.page.getByTestId(
        TestIds.dialogs.missingMediaGroup
      )
      await expect(missingMediaGroup).toBeVisible()
      await expect(
        missingMediaGroup.getByTestId(TestIds.dialogs.errorGroupDisplayMessage)
      ).toHaveText(/\S/)
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

    test('Shows missing item label and locate action', async ({
      comfyPage
    }) => {
      await loadWorkflowAndOpenErrorsTab(
        comfyPage,
        'missing/missing_media_single'
      )

      await expect(getMediaRow(comfyPage)).toHaveText(/Load Image - image/)
      await expect(
        comfyPage.page.getByTestId(TestIds.dialogs.missingMediaLocateButton)
      ).toBeVisible()
    })
  })

  test.describe('List behavior', () => {
    test('Clicking the missing item label navigates canvas to the node', async ({
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

      await getMediaRow(comfyPage)
        .getByRole('button', { name: 'Load Image - image', exact: true })
        .click()

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
