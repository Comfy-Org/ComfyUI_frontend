import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'

async function openImagePicker(comfyPage: ComfyPage) {
  const loadImage = await comfyPage.nodeOps.addNode('LoadImage')
  await comfyPage.appMode.enterAppModeWithInputs([
    [String(loadImage.id), 'image']
  ])
  await comfyPage.appMode.mobile.navigateTab('run')
  await comfyPage.appMode.mobile.tap(
    comfyPage.appMode.widgets.getSelectDropdown(`${loadImage.id}:image`).trigger
  )
  const picker = comfyPage.appMode.imagePickerPopover
  await expect(picker).toBeVisible()
  return picker
}

async function resizeViewport(
  comfyPage: ComfyPage,
  size: { width: number; height: number }
) {
  const { page } = comfyPage
  await page.setViewportSize(size)
  await expect
    .poll(() => page.evaluate(() => [window.innerWidth, window.innerHeight]))
    .toEqual([size.width, size.height])
  await comfyPage.nextFrame()
}

test.describe('App mode mobile image picker', { tag: ['@mobile'] }, () => {
  test('stays open while the on-screen keyboard shortens the viewport', async ({
    comfyPage
  }) => {
    const picker = await openImagePicker(comfyPage)
    const search = picker.getByRole('textbox')
    await expect(search).toBeFocused()

    const { width, height } = comfyPage.page.viewportSize()!
    await resizeViewport(comfyPage, {
      width,
      height: Math.round(height * 0.55)
    })

    await expect(picker).toBeVisible()
    await expect(search).toBeFocused()
  })

  test('closes when the device rotates', async ({ comfyPage }) => {
    const picker = await openImagePicker(comfyPage)

    const { width, height } = comfyPage.page.viewportSize()!
    await resizeViewport(comfyPage, { width: height, height: width })

    await expect(picker).toBeHidden()
  })
})
