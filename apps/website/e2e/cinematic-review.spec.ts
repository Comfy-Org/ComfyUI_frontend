import { expect } from '@playwright/test'

import { test } from './fixtures/modelsAccount'

for (const layout of ['e', 'd']) {
  test(`reviews a shot before generating in layout ${layout}`, async ({
    page
  }) => {
    await page.goto(`/cinematic-studio?demo=success&ux=${layout}`)
    const scene = page.getByRole('textbox', { name: 'Scene', exact: true })
    await scene.fill('A traveler arrives at a quiet station at dawn.')
    const review = page.getByRole('button', {
      name: 'Review shot',
      exact: true
    })
    await review.click()

    const dialog = page.getByRole('dialog', { name: 'Review your shot' })
    await expect(dialog).toContainText(
      'A traveler arrives at a quiet station at dawn.'
    )
    await expect(dialog).toContainText('Seedream 4.5')
    await dialog.getByRole('button', { name: 'Back to editing' }).click()
    await expect(dialog).not.toBeVisible()
    await expect(scene).toHaveValue(
      'A traveler arrives at a quiet station at dawn.'
    )
    await expect(review).toBeFocused()

    await review.click()
    await dialog
      .getByRole('button', { name: 'Generate shot', exact: true })
      .click()
    await expect(
      page.getByAltText(/A traveler arrives at a quiet station at dawn/)
    ).toBeVisible()
  })
}

for (const layout of ['e', 'd']) {
  test(`reviews and plays a video in layout ${layout}`, async ({ page }) => {
    await page.goto(`/cinematic-studio?demo=success&ux=${layout}`)
    await page.getByRole('button', { name: 'Video', exact: true }).click()
    await page
      .getByRole('textbox', { name: 'Scene', exact: true })
      .fill('A slow camera push through mountain mist.')
    if (layout === 'e')
      await page.getByRole('button', { name: /^Format/ }).click()
    await page.getByRole('combobox', { name: /^Duration/ }).selectOption('8')
    await page
      .getByRole('combobox', { name: /^Resolution/ })
      .selectOption('1080p')
    await page.getByLabel('Generate audio', { exact: true }).check()
    if (layout === 'e') await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Review shot', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Review your shot' })
    await expect(dialog).toContainText('1080p · 8s')
    await expect(dialog).toContainText('continuous action')
    await expect(
      page.getByLabel('Generated video', { exact: true })
    ).toHaveCount(0)
    await dialog
      .getByRole('button', { name: 'Generate shot', exact: true })
      .click()
    const video = page.getByLabel('Generated video', { exact: true })
    await expect(video).toBeVisible()
    await expect(video).toHaveAttribute('controls', '')
    await expect
      .poll(() =>
        video.evaluate(
          (element) =>
            getComputedStyle(element, '::-webkit-media-controls-panel').display
        )
      )
      .not.toBe('none')
    await expect
      .poll(() =>
        video.evaluate((element: HTMLVideoElement) => element.readyState)
      )
      .toBeGreaterThanOrEqual(2)
    await video.evaluate((element: HTMLVideoElement) => element.play())
    await expect
      .poll(() =>
        video.evaluate((element: HTMLVideoElement) => element.currentTime)
      )
      .toBeGreaterThan(0)
    await video.evaluate((element: HTMLVideoElement) => element.pause())
    await expect(page.getByRole('link', { name: /Download/ })).toHaveAttribute(
      'download',
      /\.webm$/
    )
    await page.getByRole('button', { name: 'Image', exact: true }).click()
    await expect(video).toHaveCount(0)
    await page.getByRole('button', { name: 'Video', exact: true }).click()
    await expect(video).toBeVisible()
  })
}
