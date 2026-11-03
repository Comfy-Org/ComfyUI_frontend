import {
  comfyExpect as expect,
  comfyPageFixture
} from '@e2e/fixtures/ComfyPage'
import {
  routeObjectInfoFromSetupApi,
  setComboInputOptions
} from '@e2e/fixtures/utils/objectInfo'
import { assetPath } from '@e2e/fixtures/utils/paths'

const test = comfyPageFixture.extend({
  page: async ({ page }, use) => {
    const unrouteObjectInfo = await routeObjectInfoFromSetupApi(
      page,
      (objectInfo) =>
        setComboInputOptions(objectInfo, 'LoadImage', 'image', [
          'mobile-picker-cat.png',
          'mobile-picker-dog.png'
        ])
    )
    await page.route(/\/api\/view\?.*filename=mobile-picker-/, (route) =>
      route.fulfill({ path: assetPath('test_upload_image.png') })
    )

    try {
      await use(page)
    } finally {
      await unrouteObjectInfo()
    }
  }
})

test.describe('App mode mobile image picker', { tag: ['@mobile'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    const loadImage = await comfyPage.nodeOps.addNode('LoadImage')
    await comfyPage.appMode.enterAppModeWithInputs([
      ['6', 'text'],
      ['7', 'text'],
      ['4', 'ckpt_name'],
      ['5', 'width'],
      ['5', 'height'],
      ['3', 'seed'],
      ['3', 'steps'],
      ['3', 'cfg'],
      [String(loadImage.id), 'image']
    ])
    await comfyPage.appMode.mobile.navigateTab('run')
  })

  test('stays open while the on-screen keyboard shortens the viewport', async ({
    comfyPage
  }) => {
    const picker = comfyPage.appMode.imagePickerPopover
    await comfyPage.appMode.mobile.tap(
      comfyPage.appMode.widgets.getSelectDropdown('image').trigger
    )
    await expect(picker).toBeVisible()
    const search = picker.getByRole('textbox')
    await expect(search).toBeFocused()

    const { width, height } = comfyPage.page.viewportSize()!
    await comfyPage.appMode.mobile.resizeViewport({
      width,
      height: Math.round(height * 0.55)
    })

    await expect(picker).toBeVisible()
    await expect(search).toBeFocused()

    const cat = picker.getByRole('img', { name: 'mobile-picker-cat.png' })
    const dog = picker.getByRole('img', { name: 'mobile-picker-dog.png' })
    const noItems = picker.getByTitle('No items')
    await expect(cat).toBeVisible()
    await expect(dog).toBeVisible()

    await search.fill('dog')
    await expect(dog).toBeVisible()
    await expect(cat).toBeHidden()

    await search.fill('no-image-matches-this-query')
    await expect(noItems).toBeVisible()
    await expect(dog).toBeHidden()
    await expect(picker).toBeVisible()
  })

  test('stays open when a keyboard that was up at open hides under a scrolled widget list', async ({
    comfyPage
  }) => {
    const { width, height } = comfyPage.page.viewportSize()!
    await comfyPage.appMode.mobile.resizeViewport({
      width,
      height: Math.round(height * 0.5)
    })
    await comfyPage.appMode.linearWidgets.evaluate((list) =>
      list.scrollTo({ top: list.scrollHeight, behavior: 'instant' })
    )
    const picker = comfyPage.appMode.imagePickerPopover
    await comfyPage.appMode.mobile.tap(
      comfyPage.appMode.widgets.getSelectDropdown('image').trigger
    )
    await expect(picker).toBeVisible()

    await comfyPage.appMode.mobile.resizeViewport({ width, height })
    await comfyPage.idleFrames(3)

    await expect(picker).toBeVisible()
  })

  test('closes when the device rotates', async ({ comfyPage }) => {
    const picker = comfyPage.appMode.imagePickerPopover
    await comfyPage.appMode.mobile.tap(
      comfyPage.appMode.widgets.getSelectDropdown('image').trigger
    )
    await expect(picker).toBeVisible()

    const { width, height } = comfyPage.page.viewportSize()!
    await comfyPage.appMode.mobile.resizeViewport({
      width: height,
      height: width
    })

    await expect(picker).toBeHidden()
  })
})
