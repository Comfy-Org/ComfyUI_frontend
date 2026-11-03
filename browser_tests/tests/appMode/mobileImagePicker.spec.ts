import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

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
    const imageWidget = comfyPage.appMode.widgets.getSelectDropdown('image')
    await comfyPage.appMode.mobile.tap(imageWidget.trigger)
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

    const imageName = await imageWidget.selectedItem()
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
