import { mergeTests } from '@playwright/test'

import { assetApiFixture } from '@e2e/fixtures/assetApiFixture'
import {
  comfyExpect as expect,
  comfyPageFixture
} from '@e2e/fixtures/ComfyPage'
import { withInputFiles } from '@e2e/fixtures/helpers/AssetHelper'

const test = mergeTests(comfyPageFixture, assetApiFixture)

test.describe(
  'LoadImage form dropdown reopen (FE-535)',
  { tag: '@vue-nodes' },
  () => {
    test('items remain visible after scroll → close → reopen', async ({
      comfyPage,
      assetApi
    }) => {
      assetApi.configure(withInputFiles(60))
      await assetApi.mock()

      await comfyPage.appMode.enableLinearMode()
      const loadImage = await comfyPage.nodeOps.addNode('LoadImage')
      const loadImageId = String(loadImage.id)
      await comfyPage.nextFrame()
      await comfyPage.appMode.enterAppModeWithInputs([[loadImageId, 'image']])

      await expect(comfyPage.appMode.linearWidgets).toBeVisible()

      const imageRow = comfyPage.appMode.widgets.getWidgetItem(
        `${loadImageId}:image`
      )
      const dropdownButton = imageRow.getByTestId('form-dropdown-trigger')

      await dropdownButton.click()
      const popover = comfyPage.appMode.imagePickerPopover
      await expect(popover).toBeVisible()

      const scrollContainer = popover.getByTestId('form-dropdown-list')
      await expect
        .poll(() => scrollContainer.locator('img').count())
        .toBeGreaterThan(0)

      await scrollContainer.evaluate((el) =>
        el.scrollTo({ top: el.scrollHeight, behavior: 'instant' })
      )

      await comfyPage.page.keyboard.press('Escape')
      await expect(popover).toBeHidden()

      await dropdownButton.click()
      await expect(popover).toBeVisible()

      await expect
        .poll(() => popover.locator('img').count(), { timeout: 5000 })
        .toBeGreaterThan(0)
    })
  }
)
