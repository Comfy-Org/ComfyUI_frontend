import { expect } from '@playwright/test'

import { t } from '../src/i18n/translations'
import { test } from './fixtures/blockExternalMedia'

const PATH_EN = '/drops'
const PATH_ZH = '/zh-CN/drops'

test.describe('Drops landing — desktop @smoke', () => {
  test('renders the configured title at /drops', async ({ page }) => {
    await page.goto(PATH_EN)
    await expect(page).toHaveTitle(t('drops.page.title', 'en'))
  })

  test('renders the localized title at /zh-CN/drops', async ({ page }) => {
    await page.goto(PATH_ZH)
    await expect(page).toHaveTitle(t('drops.page.title', 'zh-CN'))
  })

  test('is indexable at both locales', async ({ page }) => {
    await page.goto(PATH_EN)
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0)

    await page.goto(PATH_ZH)
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0)
  })
})
