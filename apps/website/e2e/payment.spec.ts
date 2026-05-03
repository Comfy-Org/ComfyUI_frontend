import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

const APP_URL = 'https://app.comfy.org'
const PLATFORM_URL = 'https://platform.comfy.org'
const BILLING_DOCS_URL = 'https://docs.comfy.org/api-reference/cloud'

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

  test('primary CTA links to ComfyUI app (default fallback)', async ({
    page
  }) => {
    const cta = page.getByRole('link', { name: /CONTINUE IN COMFYUI/i })
    await expect(cta).toBeVisible()
    await expect(cta).toHaveAttribute('href', APP_URL)
  })

  test('secondary CTA links to platform balance & usage', async ({ page }) => {
    const cta = page.getByRole('link', { name: /VIEW BALANCE & USAGE/i })
    await expect(cta).toBeVisible()
    await expect(cta).toHaveAttribute('href', PLATFORM_URL)
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

  test('primary CTA links to contact page', async ({ page }) => {
    const cta = page.getByRole('link', { name: /CONTACT SUPPORT/i })
    await expect(cta).toBeVisible()
    await expect(cta).toHaveAttribute('href', '/contact')
  })

  test('secondary CTA links to billing docs', async ({ page }) => {
    const cta = page.getByRole('link', { name: /READ BILLING DOCS/i })
    await expect(cta).toBeVisible()
    await expect(cta).toHaveAttribute('href', BILLING_DOCS_URL)
  })

  test('tertiary CTA is a close-tab button', async ({ page }) => {
    const button = page.getByRole('button', { name: /CLOSE TAB/i })
    await expect(button).toBeVisible()
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
      page.getByRole('link', { name: '返回 COMFYUI' })
    ).toHaveAttribute('href', APP_URL)
    await expect(
      page.getByRole('link', { name: '查看余额与用量' })
    ).toHaveAttribute('href', PLATFORM_URL)
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
      '/zh-CN/contact'
    )
    await expect(
      page.getByRole('link', { name: '查看计费文档' })
    ).toHaveAttribute('href', BILLING_DOCS_URL)
    await expect(page.getByRole('button', { name: '关闭页面' })).toBeVisible()
  })
})

test.describe('Payment success origin-aware referrer @interaction', () => {
  test('falls back to default app URL for non-allowlisted referrer', async ({
    page
  }) => {
    await page.goto('/payment/success', {
      referer: 'https://evil.example.com/'
    })
    const cta = page.getByRole('link', { name: /CONTINUE IN COMFYUI/i })
    await expect(cta).toHaveAttribute('href', APP_URL)
  })
})
