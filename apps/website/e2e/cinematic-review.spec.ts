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
