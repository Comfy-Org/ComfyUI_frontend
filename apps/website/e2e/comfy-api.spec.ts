import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'
import { waitForIsland } from './fixtures/islands'

const locales = [
  {
    path: '/platform/comfy-api/',
    browseApps: 'Browse apps',
    videoLabel: 'Comfy API product demo',
    unmute: 'Unmute',
    mute: 'Mute',
    copy: 'Copy prompt',
    copied: 'Copied',
    prompt: `Install comfy-cli and read its build skill:

\`pip install -U comfy-cli\`, then \`comfy skills show comfy-build\`.

It covers packaging a local ComfyUI install — models, custom nodes, dependency pins — into a build on platform.comfy.org and cutting a release. \`comfy skills show comfy-deploy\` covers running that release as a serverless endpoint.`
  },
  {
    path: '/zh-CN/platform/comfy-api/',
    browseApps: '浏览应用',
    videoLabel: 'Comfy API 产品演示',
    unmute: '取消静音',
    mute: '静音',
    copy: '复制提示词',
    copied: '已复制',
    prompt: `安装 comfy-cli，并阅读它的构建技能：

先 \`pip install -U comfy-cli\`，再运行 \`comfy skills show comfy-build\`。

它会把本地 ComfyUI 安装（模型、自定义节点、依赖版本）打包成 platform.comfy.org 上的一个可复现构建，并完成发布。\`comfy skills show comfy-deploy\` 则说明如何把该发布作为无服务器端点运行。`
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
      await expect(section.getByTestId('player-control-bar')).toBeVisible()

      await section
        .getByRole('button', { name: locale.unmute, exact: true })
        .click()

      await expect(video).toHaveJSProperty('muted', false)
      await expect(
        section.getByRole('button', { name: locale.mute, exact: true })
      ).toBeVisible()
    })

    test('copies the localized deployment prompt to the clipboard', async ({
      page,
      context
    }) => {
      await context.grantPermissions(['clipboard-read', 'clipboard-write'])
      const copy = page.getByRole('button', { name: locale.copy, exact: true })
      await waitForIsland(page, copy)
      await copy.click()

      await expect
        .poll(() => page.evaluate(() => navigator.clipboard.readText()))
        .toBe(locale.prompt)
      await expect(
        page.getByRole('button', { name: locale.copied, exact: true })
      ).toBeVisible()
    })
  })
}
