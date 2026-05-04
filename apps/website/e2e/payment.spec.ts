import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { externalLinks } from '../src/config/routes'
import { test } from './fixtures/blockExternalMedia'

const CLOUD_URL = externalLinks.cloud
const PLATFORM_USAGE_URL = externalLinks.platformUsage
const SUPPORT_URL = externalLinks.support
const DOCS_SUBSCRIPTION_URL = externalLinks.docsSubscription

async function expectNoIndex(page: Page) {
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    'content',
    'noindex, nofollow'
  )
}

test.describe('Payment success page @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/payment/success')
  })

  test('has correct title and is noindex', async ({ page }) => {
    await expect(page).toHaveTitle('Payment Successful — Comfy')
    await expectNoIndex(page)
  })

  test('shows success heading and subtitle', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /Payment successful/i, level: 1 })
    ).toBeVisible()
    await expect(page.getByText(/Thanks for your purchase/i)).toBeVisible()
  })

  test('primary CTA links to Comfy Cloud', async ({ page }) => {
    const cta = page.getByRole('link', { name: /CONTINUE TO COMFY CLOUD/i })
    await expect(cta).toBeVisible()
    await expect(cta).toHaveAttribute('href', CLOUD_URL)
  })

  test('secondary CTA links to platform usage page', async ({ page }) => {
    const cta = page.getByRole('link', { name: /VIEW USAGE/i })
    await expect(cta).toBeVisible()
    await expect(cta).toHaveAttribute('href', PLATFORM_USAGE_URL)
  })
})

test.describe('Payment failed page @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/payment/failed')
  })

  test('has correct title and is noindex', async ({ page }) => {
    await expect(page).toHaveTitle('Payment Failed — Comfy')
    await expectNoIndex(page)
  })

  test('shows failure heading and subtitle', async ({ page }) => {
    await expect(
      page.getByRole('heading', {
        name: /Payment was not completed/i,
        level: 1
      })
    ).toBeVisible()
    await expect(page.getByText(/payment didn't go through/i)).toBeVisible()
  })

  test('primary CTA links to support help center', async ({ page }) => {
    const cta = page.getByRole('link', { name: /CONTACT SUPPORT/i })
    await expect(cta).toBeVisible()
    await expect(cta).toHaveAttribute('href', SUPPORT_URL)
  })

  test('secondary CTA links to subscription docs', async ({ page }) => {
    const cta = page.getByRole('link', { name: /READ SUBSCRIPTION DOCS/i })
    await expect(cta).toBeVisible()
    await expect(cta).toHaveAttribute('href', DOCS_SUBSCRIPTION_URL)
  })
})

test.describe('Payment pages zh-CN @smoke', () => {
  test('zh-CN success page renders and links correctly', async ({ page }) => {
    await page.goto('/zh-CN/payment/success')
    await expect(page).toHaveTitle('支付成功 — Comfy')
    await expectNoIndex(page)
    await expect(
      page.getByRole('heading', { name: '支付成功', level: 1 })
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: '前往 COMFY CLOUD' })
    ).toHaveAttribute('href', CLOUD_URL)
    await expect(page.getByRole('link', { name: '查看用量' })).toHaveAttribute(
      'href',
      PLATFORM_USAGE_URL
    )
  })

  test('zh-CN failed page renders and links correctly', async ({ page }) => {
    await page.goto('/zh-CN/payment/failed')
    await expect(page).toHaveTitle('支付失败 — Comfy')
    await expectNoIndex(page)
    await expect(
      page.getByRole('heading', { name: '支付未完成', level: 1 })
    ).toBeVisible()
    await expect(page.getByRole('link', { name: '联系支持' })).toHaveAttribute(
      'href',
      SUPPORT_URL
    )
    await expect(
      page.getByRole('link', { name: '查看订阅文档' })
    ).toHaveAttribute('href', DOCS_SUBSCRIPTION_URL)
  })
})
