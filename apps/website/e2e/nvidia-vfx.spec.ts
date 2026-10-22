import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

test.describe('Nvidia VFX Nodes launch page @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/nvidia-vfx')
  })

  test('introduces the nodes and opens the Cloud template', async ({
    page
  }) => {
    await expect(
      page.getByRole('heading', { level: 1, name: 'Nvidia VFX Nodes' })
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'TRY ON COMFY CLOUD' })
    ).toHaveAttribute('href', /template=utility_nvidia_rtx_video_enhance/)
  })

  test('switches the before and after clips with the tabs', async ({
    page
  }) => {
    await page
      .getByRole('heading', { level: 2, name: 'One clip, two states.' })
      .scrollIntoViewIfNeeded()
    const before = page.getByTestId('video-compare-before')
    const after = page.getByTestId('video-compare-after')

    await expect(before).toHaveAttribute('src', /super-resolution-before\.mp4$/)

    await page.getByRole('tab', { name: 'Frame Generation' }).click()

    await expect(before).toHaveAttribute('src', /frame-generation-before\.mp4$/)
    await expect(after).toHaveAttribute('src', /frame-generation-after\.mp4$/)
    await expect(
      page.getByText(
        'Multiply frame rate up to 16× with Frame Generation for smooth slow motion.',
        { exact: true }
      )
    ).toBeVisible()
  })

  test('opens the workflow screenshot full screen and closes it on Escape', async ({
    page
  }) => {
    const tile = page.getByTestId('gallery-card-media')
    await tile.scrollIntoViewIfNeeded()
    const dialog = page.getByRole('dialog')

    await expect(async () => {
      await tile.getByRole('button', { name: 'Fullscreen' }).click()
      await expect(dialog).toBeVisible({ timeout: 1000 })
    }).toPass()
    await expect(
      dialog.getByRole('img', { name: /chained in one ComfyUI workflow/ })
    ).toBeVisible()

    await page.keyboard.press('Escape')

    await expect(dialog).toBeHidden()
  })
})
