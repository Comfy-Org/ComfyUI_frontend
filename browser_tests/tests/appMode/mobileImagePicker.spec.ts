import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe('App mode mobile image picker', { tag: ['@mobile'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    const loadImage = await comfyPage.nodeOps.addNode('LoadImage')
    await comfyPage.appMode.enterAppModeWithInputs([
      [String(loadImage.id), 'image']
    ])
    await comfyPage.appMode.mobile.navigateTab('run')
    await comfyPage.appMode.mobile.tap(
      comfyPage.appMode.widgets.getSelectDropdown('image').trigger
    )
    await expect(comfyPage.appMode.imagePickerPopover).toBeVisible()
  })

  test('stays open while the on-screen keyboard shortens the viewport', async ({
    comfyPage
  }) => {
    const picker = comfyPage.appMode.imagePickerPopover
    const search = picker.getByRole('textbox')
    await expect(search).toBeFocused()

    const { width, height } = comfyPage.page.viewportSize()!
    await comfyPage.appMode.mobile.resizeViewport({
      width,
      height: Math.round(height * 0.55)
    })

    await expect(picker).toBeVisible()
    await expect(search).toBeFocused()

    const imageName = await comfyPage.appMode.widgets
      .getSelectDropdown('image')
      .selectedItem()
    const imageItem = picker.getByRole('img', { name: imageName })
    const noItems = picker.getByTitle('No items')
    await expect(imageItem).toBeVisible()

    await search.fill('no-image-matches-this-query')
    await expect(noItems).toBeVisible()
    await expect(imageItem).toBeHidden()

    await search.fill(imageName)
    await expect(imageItem).toBeVisible()
    await expect(noItems).toBeHidden()
    await expect(picker).toBeVisible()
  })

  test('closes when the device rotates', async ({ comfyPage }) => {
    const { width, height } = comfyPage.page.viewportSize()!
    await comfyPage.appMode.mobile.resizeViewport({
      width: height,
      height: width
    })

    await expect(comfyPage.appMode.imagePickerPopover).toBeHidden()
  })
})
