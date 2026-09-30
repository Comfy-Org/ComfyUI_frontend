import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'
import { waitForIsland } from './fixtures/islands'

const locales = [
  {
    path: '/platform/comfy-api/',
    browseApps: 'Browse apps',
    videoLabel: 'Comfy API product demo',
    unmute: 'Unmute',
    mute: 'Mute'
  },
  {
    path: '/zh-CN/platform/comfy-api/',
    browseApps: '浏览应用',
    videoLabel: 'Comfy API 产品演示',
    unmute: '取消静音',
    mute: '静音'
  }
]

for (const locale of locales) {
  test.describe(`Comfy API ${locale.path} @smoke`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(locale.path)
    })

    test('offers Creative Apps through the apps hub', async ({ page }) => {
      const browseApps = page.getByRole('link', {
        name: locale.browseApps,
        exact: true
      })

      await expect(browseApps).toBeVisible()
      await expect(browseApps).toHaveAttribute('href', '/hub/apps/')
    })

    test('autoplays the product demo muted and lets visitors unmute it', async ({
      page
    }) => {
      const video = page.getByLabel(locale.videoLabel, { exact: true })
      const section = page.locator('section').filter({ has: video })
      await waitForIsland(page, video)

      await expect(video).toHaveAttribute(
        'src',
        'https://media.comfy.org/website/comfy-api/comfy-api-product-demo.mp4'
      )
      await expect(video).toHaveJSProperty('paused', false)
      await expect(video).toHaveJSProperty('muted', true)

      await section
        .getByRole('button', { name: locale.unmute, exact: true })
        .click()

      await expect(video).toHaveJSProperty('muted', false)
      await expect(
        section.getByRole('button', { name: locale.mute, exact: true })
      ).toBeVisible()
    })
  })
}

test('copies the deployment prompt to the clipboard @smoke', async ({
  page,
  context
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/platform/comfy-api/')
  const copy = page.getByRole('button', { name: 'Copy prompt', exact: true })
  await waitForIsland(page, copy)
  await copy.click()

  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toContain('comfy skills show comfy-build')
  await expect(
    page.getByRole('button', { name: 'Copied', exact: true })
  ).toBeVisible()
})
