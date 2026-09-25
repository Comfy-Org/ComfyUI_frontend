import { expect } from '@playwright/test'
import { test } from './fixtures/modelsAccount'

for (const width of [1440, 390]) {
  test(`video starters fill a draft and explain durations without submitting at ${width}px`, async ({
    page,
    context
  }) => {
    await page.setViewportSize({ width, height: 900 })
    const submissions: string[] = []
    await context.route('**/v2/models/**', (route) => {
      if (route.request().method() === 'POST')
        submissions.push(route.request().url())
      return route.abort()
    })
    await page.goto('/cinematic-studio?demo=success')
    const scene = page.getByRole('textbox', { name: 'Scene', exact: true })
    await scene.fill('My still image draft')
    await page.getByRole('button', { name: 'Video', exact: true }).click()
    await expect(
      page.getByRole('heading', { name: 'Bring your scene to life.' })
    ).toBeVisible()
    const starters = page.getByTestId('cinematic-video-starter')
    await expect(starters).toHaveCount(3)
    await starters.filter({ hasText: 'Slow cinematic push-in' }).click()
    await expect(scene).toHaveValue(/camera slowly pushes/)
    await expect(scene).toBeFocused()
    await expect(
      page.getByRole('dialog', { name: 'Review your shot' })
    ).not.toBeVisible()
    await page
      .getByRole('button', { name: /Model · via Comfy Router:/ })
      .click()
    const model = page.getByRole('menuitemradio', { name: /Seedance 2.5 Text/ })
    await expect(model).toContainText('5s')
    await expect(model).toContainText('Studio starting point: 5s')
    await page.keyboard.press('Escape')
    await page
      .getByRole('button', { name: 'Choose a starting image', exact: true })
      .click()
    await expect(
      page.getByTestId('cinematic-reference-firstFrame')
    ).toBeAttached()
    await page.getByTestId('cinematic-reference-firstFrame').setInputFiles({
      name: 'frame.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=',
        'base64'
      )
    })
    await page.keyboard.press('Escape')
    await starters.filter({ hasText: 'Follow a moving subject' }).click()
    await expect(scene).toHaveValue(
      /Preserve the subject and setting of the starting frame/
    )
    await expect(scene).not.toHaveValue(/rider/)
    await page
      .getByRole('button', { name: 'Choose from your creations', exact: true })
      .click()
    await expect(
      page.getByRole('dialog', { name: 'Your creations', exact: true })
    ).toBeVisible()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Close', exact: true })
      .click()
    await page.getByRole('button', { name: 'Image', exact: true }).click()
    await expect(scene).toHaveValue('My still image draft')
    expect(submissions).toEqual([])
  })
}
