import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

const MCP_ENDPOINT = 'https://cloud.comfy.org/mcp'

test.describe('MCP page @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/mcp')
  })

  test('hero and how-it-works INSTALL MCP CTAs anchor to setup', async ({
    page
  }) => {
    const installLinks = page.getByRole('link', { name: 'INSTALL MCP' })
    await expect(installLinks).toHaveCount(2)
    for (const link of await installLinks.all()) {
      await expect(link).toHaveAttribute('href', '#setup')
    }
  })

  test('setup section shows both install options', async ({ page }) => {
    const setup = page.locator('#setup')
    await setup.scrollIntoViewIfNeeded()
    await expect(
      setup.getByRole('heading', {
        name: 'Ask your agent to install Comfy MCP'
      })
    ).toBeVisible()
    await expect(
      setup.getByRole('heading', { name: 'Install manually' })
    ).toBeVisible()
    await expect(setup.getByText(MCP_ENDPOINT, { exact: true })).toBeVisible()
  })

  test('client tabs swap install instructions', async ({ page }) => {
    const setup = page.locator('#setup')
    await setup.scrollIntoViewIfNeeded()
    const activePanel = setup.locator('[role="tabpanel"][data-state="active"]')

    // Claude Code is the default tab and carries the CLI command
    await expect(
      setup.getByRole('tab', { name: 'Claude Code' })
    ).toHaveAttribute('data-state', 'active')
    await expect(activePanel).toContainText(
      `claude mcp add --transport http comfy-cloud ${MCP_ENDPOINT}`
    )

    await setup.getByRole('tab', { name: 'Claude Desktop' }).click()
    await expect(activePanel).toContainText('Add custom connector')

    await setup.getByRole('tab', { name: 'Cursor' }).click()
    await expect(activePanel).toContainText('X-API-Key')
    await expect(
      activePanel.getByRole('link', { name: 'platform.comfy.org' })
    ).toHaveAttribute('href', 'https://platform.comfy.org/profile/api-keys')

    await setup.getByRole('tab', { name: 'Codex' }).click()
    await expect(activePanel).toContainText(
      `codex mcp add comfy-cloud --url ${MCP_ENDPOINT}`
    )
  })

  test('skills plugin link lives in the agent option card', async ({
    page
  }) => {
    const setup = page.locator('#setup')
    await setup.scrollIntoViewIfNeeded()
    await expect(
      setup.getByRole('link', { name: 'View on GitHub' })
    ).toHaveAttribute('href', 'https://github.com/Comfy-Org/comfy-skills')
  })

  test('capabilities section shows all six tool cards', async ({ page }) => {
    for (const title of [
      'Generate anything',
      'Search the ecosystem',
      'Run real workflows',
      'Direct any model',
      'Generate in batches',
      'Ship it as an app'
    ]) {
      await expect(
        page.getByRole('heading', { name: title, exact: true })
      ).toBeVisible()
    }
  })

  test('FAQ lists nine questions and autolinks the server URL', async ({
    page
  }) => {
    const triggers = page.locator('[id^="faq-trigger-"]')
    await triggers.first().scrollIntoViewIfNeeded()
    await expect(triggers).toHaveCount(9)

    await page.getByRole('button', { name: "What's the server URL?" }).click()
    await expect(
      page.getByRole('link', { name: MCP_ENDPOINT, exact: true })
    ).toHaveAttribute('href', MCP_ENDPOINT)
  })
})

type ShiftWindow = Window & { __cls?: number }

/**
 * The hero demo types and cascades forever, so any layout it disturbs is
 * charged to the page's CLS on every cycle. Google treats 0.1 as the limit.
 */
const CLS_BUDGET = 0.1

test.describe('MCP hero demo layout stability', () => {
  for (const viewport of [
    { name: 'mobile', width: 390, height: 844 },
    { name: 'desktop', width: 1440, height: 900 }
  ]) {
    test(`animating the hero demo does not shift the page on ${viewport.name}`, async ({
      page
    }) => {
      await page.setViewportSize(viewport)
      await page.addInitScript(() => {
        ;(window as ShiftWindow).__cls = 0
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const shift = entry as PerformanceEntry & {
              value: number
              hadRecentInput: boolean
            }
            if (!shift.hadRecentInput) {
              const w = window as ShiftWindow
              w.__cls = (w.__cls ?? 0) + shift.value
            }
          }
        }).observe({ type: 'layout-shift', buffered: true })
      })

      await page.goto('/mcp')

      const cards = page.getByTestId('mcp-demo-card')
      await expect(cards).toHaveCount(5)

      // Let two full cascade cycles run, so the card-exit transition and the
      // typing reflow both get charged to CLS before we read it.
      for (let cycle = 0; cycle < 2; cycle++) {
        const newest = await cards.first().innerText()
        await expect(cards.first()).not.toHaveText(newest, { timeout: 20000 })
        await expect(cards).toHaveCount(5)
      }

      const cls = await page.evaluate(() => (window as ShiftWindow).__cls ?? 0)
      expect(cls).toBeLessThan(CLS_BUDGET)
    })
  }
})

test.describe('MCP page zh-CN @smoke', () => {
  test('setup section renders localized options', async ({ page }) => {
    await page.goto('/zh-CN/mcp')
    const setup = page.locator('#setup')
    await setup.scrollIntoViewIfNeeded()
    await expect(setup.getByText('方式一')).toBeVisible()
    await expect(setup.getByRole('heading', { name: '手动安装' })).toBeVisible()
    await expect(setup.getByText(MCP_ENDPOINT, { exact: true })).toBeVisible()
  })
})
