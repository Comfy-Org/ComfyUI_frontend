import type { Page } from '@playwright/test'
import { mergeTests } from '@playwright/test'

import { assetApiFixture } from '@e2e/fixtures/assetApiFixture'
import {
  comfyExpect as expect,
  comfyPageFixture
} from '@e2e/fixtures/ComfyPage'
import { withInputFiles } from '@e2e/fixtures/helpers/AssetHelper'

const test = mergeTests(comfyPageFixture, assetApiFixture)

async function addNode(page: Page, nodeType: string): Promise<string> {
  return page.evaluate((type) => {
    const node = window.app!.graph.add(
      window.LiteGraph!.createNode(type, undefined, {})
    )
    return String(node!.id)
  }, nodeType)
}

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
      const loadImageId = await addNode(comfyPage.page, 'LoadImage')
      await comfyPage.nextFrame()
      await comfyPage.appMode.enterAppModeWithInputs([[loadImageId, 'image']])

      const widgetList = comfyPage.appMode.linearWidgets
      await expect(widgetList).toBeVisible()

      const imageRow = widgetList.locator(
        'div:has(> div > span:text-is("image"))'
      )
      const dropdownButton = imageRow.locator('button:has(> span)').first()

      await dropdownButton.click()
      const popover = comfyPage.appMode.imagePickerPopover
      await expect(popover).toBeVisible()

      const scrollContainer = popover
        .locator('[data-capture-wheel] > div')
        .nth(2)
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
