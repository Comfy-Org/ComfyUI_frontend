import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

test.describe('Payment success page @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/payment/success')
  })

  test('has correct title', async ({ page }) => {
    await expect(page).toHaveTitle('Payment Successful — Comfy')
  })

  test('is marked noindex', async ({ page }) => {
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex, nofollow'
    )
  })

  test('shows success heading and subtitle', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /Payment successful/i, level: 1 })
    ).toBeVisible()
    await expect(page.getByText(/Thanks for your purchase/i)).toBeVisible()
  })

  test('primary CTA links to platform dashboard', async ({ page }) => {
    const cta = page.getByRole('link', { name: /GO TO DASHBOARD/i })
    await expect(cta).toBeVisible()
    await expect(cta).toHaveAttribute('href', 'https://platform.comfy.org/')
  })

  test('secondary CTA links back to home', async ({ page }) => {
    const cta = page.getByRole('link', { name: /BACK TO HOME/i })
    await expect(cta).toBeVisible()
    await expect(cta).toHaveAttribute('href', '/')
  })
})

test.describe('Payment failed page @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/payment/failed')
  })

  test('has correct title', async ({ page }) => {
    await expect(page).toHaveTitle('Payment Failed — Comfy')
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

  test('primary CTA links to platform dashboard', async ({ page }) => {
    const cta = page.getByRole('link', { name: /TRY AGAIN/i })
    await expect(cta).toBeVisible()
    await expect(cta).toHaveAttribute('href', 'https://platform.comfy.org/')
  })

  test('secondary CTA links to contact page', async ({ page }) => {
    const cta = page.getByRole('link', { name: /CONTACT SUPPORT/i })
    await expect(cta).toBeVisible()
    await expect(cta).toHaveAttribute('href', '/contact')
  })
})

test.describe('Payment pages zh-CN @smoke', () => {
  test('zh-CN success page has Chinese title and dashboard CTA', async ({
    page
  }) => {
    await page.goto('/zh-CN/payment/success')
    await expect(page).toHaveTitle('支付成功 — Comfy')
    await expect(
      page.getByRole('heading', { name: '支付成功', level: 1 })
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: '前往控制台' })
    ).toHaveAttribute('href', 'https://platform.comfy.org/')
    await expect(page.getByRole('link', { name: '返回首页' })).toHaveAttribute(
      'href',
      '/zh-CN/'
    )
  })

  test('zh-CN failed page has Chinese title and contact CTA', async ({
    page
  }) => {
    await page.goto('/zh-CN/payment/failed')
    await expect(page).toHaveTitle('支付失败 — Comfy')
    await expect(
      page.getByRole('heading', { name: '支付未完成', level: 1 })
    ).toBeVisible()
    await expect(page.getByRole('link', { name: '联系支持' })).toHaveAttribute(
      'href',
      '/zh-CN/contact'
    )
  })
})
