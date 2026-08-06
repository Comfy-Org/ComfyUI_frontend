import { expect } from '@playwright/test'

import { t } from '../src/i18n/translations'
import { test } from './fixtures/blockExternalMedia'

test.describe('FDCT page @smoke', () => {
  test('responds 200 and has the localized title', async ({ page }) => {
    const response = await page.goto('/fdct')
    expect(response?.status()).toBe(200)
    await expect(page).toHaveTitle(t('fdct.meta.title', 'en'))
  })
})

test.describe('FDCT page (zh-CN) @smoke', () => {
  test('responds 200 and has the localized title', async ({ page }) => {
    const response = await page.goto('/zh-CN/fdct')
    expect(response?.status()).toBe(200)
    await expect(page).toHaveTitle(t('fdct.meta.title', 'zh-CN'))
  })
})
