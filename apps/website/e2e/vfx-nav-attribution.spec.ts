import assert from 'node:assert/strict'
import { expect } from '@playwright/test'
import { test } from './fixtures/blockExternalMedia'
import { expectIslandHydrated } from './fixtures/islands'

const TRACKED =
  'https://cloud.comfy.org/?utm_source=comfy_org&utm_medium=website&utm_campaign=free_tier&utm_content=nav_try_cloud'
for (const { path, label, expected } of [
  {
    path: '/solutions/vfx/v3/',
    label: 'TRY CLOUD FOR FREE',
    expected: 'https://cloud.comfy.org/'
  },
  {
    path: '/zh-CN/solutions/vfx/v3/',
    label: '免费试用云端',
    expected: 'https://cloud.comfy.org/'
  },
  { path: '/solutions/vfx/', label: 'TRY CLOUD FOR FREE', expected: TRACKED },
  { path: '/zh-CN/solutions/vfx/', label: '免费试用云端', expected: TRACKED },
  { path: '/', label: 'TRY CLOUD FOR FREE', expected: TRACKED }
]) {
  test(`${path} scopes cloud nav attribution in SSR and after hydration`, async ({
    page
  }) => {
    const response = await page.goto(
      `${path}?utm_source=linkedin&utm_medium=paid_social&utm_campaign=vfx`
    )
    assert(response)
    const html = await response.text()
    const serverHref = await page.evaluate(
      ({ html, label }) => {
        const document = new DOMParser().parseFromString(html, 'text/html')
        return Array.from(
          document.querySelectorAll('[data-testid="desktop-nav-cta"] a')
        )
          .find((node) => node.getAttribute('aria-label') === label)
          ?.getAttribute('href')
      },
      { html, label }
    )
    expect(serverHref).toBe(expected)
    const nav = page
      .getByTestId('desktop-nav-cta')
      .getByRole('link', { name: label, exact: true })
    await expectIslandHydrated(page, page.getByTestId('desktop-nav-cta'))
    await expect(nav).toHaveAttribute('href', expected)
    await page.evaluate(() =>
      document.dispatchEvent(new Event('astro:page-load'))
    )
    await expect(nav).toHaveAttribute('href', expected)
  })
}
for (const path of ['/solutions/vfx/v3/', '/zh-CN/solutions/vfx/v3/']) {
  test(`${path} preserves attribution on contact, workflow and Studio signup links`, async ({
    page
  }) => {
    await page.goto(`${path}?utm_source=linkedin&utm_campaign=vfx`)
    await expect(
      page.locator('[data-vfx-v3] a[href*="/contact/"]').first()
    ).toHaveAttribute(
      'href',
      /interest=vfx&landing_version=v3&utm_source=linkedin&utm_campaign=vfx/
    )
    await expect(
      page.locator('[data-vfx-demo="swap"] [data-try-workflow]')
    ).toHaveAttribute(
      'href',
      'https://cloud.comfy.org/?share=28fa6219c110&utm_source=linkedin&utm_campaign=vfx'
    )
    await expect(
      page.locator('[data-vfx-studio] a[href*="/cloud/signup"]').first()
    ).toHaveAttribute(
      'href',
      'https://cloud.comfy.org/cloud/signup?utm_source=linkedin&utm_campaign=vfx'
    )
  })
}
test('restores the normal nav URL when navigating away from V3', async ({
  page
}) => {
  await page.goto('/solutions/vfx/?utm_source=linkedin')
  const nav = page
    .getByTestId('desktop-nav-cta')
    .getByRole('link', { name: 'TRY CLOUD FOR FREE', exact: true })
  await expectIslandHydrated(page, page.getByTestId('desktop-nav-cta'))
  await expect(nav).toHaveAttribute('href', TRACKED)
  await page.evaluate(() => {
    history.pushState(null, '', '/solutions/vfx/v3/?utm_source=linkedin')
    document.dispatchEvent(new Event('astro:page-load'))
  })
  await expect(nav).toHaveAttribute('href', 'https://cloud.comfy.org/')
  await page.evaluate(() => {
    history.pushState(null, '', '/pricing/')
    document.dispatchEvent(new Event('astro:page-load'))
  })
  await expect(nav).toHaveAttribute('href', TRACKED)
})
