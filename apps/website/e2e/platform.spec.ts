import { expect, test } from '@playwright/test'

import { t } from '../src/i18n/translations'

test.describe('Developer Platform product navigation @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/platform')
  })

  for (const [label, path] of [
    [t('platform.products.serverless.title', 'en'), '/platform/comfy-api'],
    [t('platform.products.models.title', 'en'), '/platform/models'],
    [t('platform.products.builder.title', 'en'), '/platform/builder']
  ] as const) {
    test(`${label} card navigates to ${path}`, async ({ page }) => {
      const cardLink = page.getByRole('link', { name: label, exact: true })

      await expect(cardLink).toBeVisible()
      await cardLink.click()
      await expect(page).toHaveURL(path)
    })
  }
})
