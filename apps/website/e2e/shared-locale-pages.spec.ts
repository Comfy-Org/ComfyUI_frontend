import { expect } from '@playwright/test'

import {
  bannerConfig,
  challengeBannerConfig,
  getBannerData
} from '@/config/banner'
import { test } from './fixtures/blockExternalMedia'

const pages = [
  {
    path: '/',
    locale: 'en',
    title: 'Comfy - Professional Control of Visual AI'
  },
  { path: '/', locale: 'zh-CN', title: 'Comfy - 视觉 AI 的最强可控性' },
  {
    path: '/',
    locale: 'ja',
    title: 'Comfy - ビジュアルAIを自在にコントロール'
  },
  { path: '/about/', locale: 'en', title: 'About Us - Comfy' },
  { path: '/about/', locale: 'zh-CN', title: '关于我们 - Comfy' },
  {
    path: '/download/',
    locale: 'en',
    title: 'Download Comfy Desktop - Run AI on Your Hardware'
  },
  {
    path: '/download/',
    locale: 'zh-CN',
    title: '下载 Comfy 桌面版 - 在您的硬件上运行 AI'
  },
  {
    path: '/cloud/',
    locale: 'en',
    title: 'Comfy Cloud - AI in the Cloud'
  },
  { path: '/cloud/', locale: 'zh-CN', title: 'Comfy Cloud - 云端 AI' },
  { path: '/platform/', locale: 'en', title: 'Developer Platform' },
  { path: '/platform/', locale: 'zh-CN', title: '开发者平台' },
  { path: '/pricing/', locale: 'en', title: 'Pricing - Comfy Cloud' },
  { path: '/pricing/', locale: 'zh-CN', title: '定价 - Comfy Cloud' }
] as const

for (const { path, locale, title } of pages) {
  test(`shared ${locale} ${path} keeps its localized title and language`, async ({
    page
  }) => {
    await page.goto(locale === 'en' ? path : `/${locale}${path}`)

    await expect(page).toHaveTitle(title)
    await expect(page.locator('html')).toHaveAttribute('lang', locale)
  })
}

test('Chinese platform renders its active page banner in Chinese', async ({
  page
}) => {
  const sitewide = getBannerData(bannerConfig, 'zh-CN')
  const challenge = getBannerData(challengeBannerConfig, 'zh-CN')

  await page.goto('/zh-CN/platform/')

  const banner = page.locator('[data-slot="announcement-banner"]')
  await expect(
    banner
      .getByText(sitewide.title, { exact: true })
      .or(banner.getByText(challenge.title, { exact: true }))
  ).toBeVisible()
  await expect(banner).not.toContainText(
    getBannerData(bannerConfig, 'en').title
  )
  await expect(banner).not.toContainText(
    getBannerData(challengeBannerConfig, 'en').title
  )
})
