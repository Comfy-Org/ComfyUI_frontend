import { expect } from '@playwright/test'

import { mediaLightboxZoomTest as test } from '@e2e/fixtures/mediaLightboxZoomFixture'

test.describe('Media lightbox image zoom', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage, zoomImages }) => {
    await comfyPage.menu.assetsTab.open()
    await comfyPage.page.getByRole('img', { name: zoomImages.first }).dblclick()
    await comfyPage.mediaLightbox.expectImageLoaded(
      zoomImages.first,
      zoomImages.size
    )
    await expect(comfyPage.mediaLightbox.zoomPercentage).toBeHidden()
  })

  test('zooms in on wheel and shows the zoom level', async ({
    comfyPage,
    zoomImages
  }) => {
    const lightbox = comfyPage.mediaLightbox

    await lightbox.wheelOverImage(-100)

    await expect(lightbox.zoomPercentage).toHaveText('110%')
    await expect
      .poll(async () => (await lightbox.zoomTargetBox()).width)
      .toBeCloseTo(zoomImages.size * 1.1)
  })

  test('toggles between 2x and the fitted size on double-click', async ({
    comfyPage,
    zoomImages
  }) => {
    const lightbox = comfyPage.mediaLightbox

    await lightbox.zoomTarget.dblclick()
    await expect(lightbox.zoomPercentage).toHaveText('200%')
    await expect
      .poll(async () => (await lightbox.zoomTargetBox()).width)
      .toBeCloseTo(zoomImages.size * 2)

    await lightbox.zoomTarget.dblclick()
    await expect(lightbox.zoomPercentage).toBeHidden()
    await expect
      .poll(async () => (await lightbox.zoomTargetBox()).width)
      .toBeCloseTo(zoomImages.size)
  })

  test('pans a zoomed image and stays open when released over the background', async ({
    comfyPage
  }) => {
    const lightbox = comfyPage.mediaLightbox
    await lightbox.zoomTarget.dblclick()
    await expect(lightbox.zoomPercentage).toHaveText('200%')
    const before = await lightbox.zoomTargetBox()

    const { dy } = await lightbox.dragImageToBottomEdge()

    await expect(lightbox.root).toBeVisible()
    await expect
      .poll(async () => (await lightbox.zoomTargetBox()).y - before.y)
      .toBeCloseTo(dy, 0)
  })

  test('resets the zoom when moving to the next image', async ({
    comfyPage,
    zoomImages
  }) => {
    const lightbox = comfyPage.mediaLightbox
    await lightbox.zoomTarget.dblclick()
    await expect(lightbox.zoomPercentage).toHaveText('200%')

    await lightbox.nextButton.click()

    await lightbox.expectImageLoaded(zoomImages.second, zoomImages.size)
    await expect(lightbox.zoomPercentage).toBeHidden()
    await expect
      .poll(async () => (await lightbox.zoomTargetBox()).width)
      .toBeCloseTo(zoomImages.size)
  })
})
