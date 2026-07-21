import type { Locator } from '@playwright/test'
import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

const MCP_ENDPOINT = 'https://cloud.comfy.org/mcp'

// The setup island hydrates on visibility; clicks before hydration are
// no-ops, so retry until the tab actually activates.
async function selectClientTab(setup: Locator, name: string) {
  const tab = setup.getByRole('tab', { name })
  await expect(async () => {
    await tab.click()
    await expect(tab).toHaveAttribute('data-state', 'active', { timeout: 500 })
  }).toPass()
}

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

  test('Claude Desktop is the default tab and shows only the connector card', async ({
    page
  }) => {
    const setup = page.locator('#setup')
    await setup.scrollIntoViewIfNeeded()
    await expect(
      setup.getByRole('tab', { name: 'Claude Desktop' })
    ).toHaveAttribute('data-state', 'active')
    await expect(
      setup.getByRole('heading', { name: 'Add Custom Connector' })
    ).toBeVisible()
    await expect(setup.getByText(MCP_ENDPOINT, { exact: true })).toBeVisible()
    await expect(
      setup.getByRole('heading', {
        name: 'Ask your agent to install Comfy MCP'
      })
    ).toHaveCount(0)
    await expect(setup.locator('video')).toBeVisible()
  })

  test('client tabs swap install instructions and agent-card visibility', async ({
    page
  }) => {
    const setup = page.locator('#setup')
    await setup.scrollIntoViewIfNeeded()
    const activePanel = setup.locator('[role="tabpanel"][data-state="active"]')
    const agentHeading = setup.getByRole('heading', {
      name: 'Ask your agent to install Comfy MCP'
    })

    await expect(activePanel).toContainText('Add custom connector')

    // First interaction retries until the island hydrates; later switches
    // assert synchronously so steady-state click regressions fail.
    await selectClientTab(setup, 'Claude Code Terminal')
    await expect(activePanel).toContainText(
      `claude mcp add --transport http comfy-cloud ${MCP_ENDPOINT}`
    )
    await expect(
      setup.getByRole('heading', { name: 'Install manually' })
    ).toBeVisible()
    await expect(agentHeading).toBeVisible()

    await setup.getByRole('tab', { name: 'Codex' }).click()
    await expect(activePanel).toContainText(
      `codex mcp add comfy-cloud --url ${MCP_ENDPOINT}`
    )
    await expect(agentHeading).toHaveCount(0)
    await expect(setup.locator('video')).toBeVisible()

    await setup.getByRole('tab', { name: 'Cursor' }).click()
    await expect(activePanel).toContainText('X-API-Key')
    await expect(
      activePanel.getByRole('link', { name: 'platform.comfy.org' })
    ).toHaveAttribute('href', 'https://platform.comfy.org/profile/api-keys')
    await expect(agentHeading).toBeVisible()

    await setup.getByRole('tab', { name: 'OpenClaw' }).click()
    await expect(activePanel).toContainText(
      'openclaw skills install @comfy-org/comfy'
    )
    await expect(agentHeading).toBeVisible()

    await setup.getByRole('tab', { name: 'Others' }).click()
    await expect(activePanel).toContainText('remote MCP server')
    await expect(agentHeading).toBeVisible()
  })

  test('skills plugin link lives in the agent option card', async ({
    page
  }) => {
    const setup = page.locator('#setup')
    await setup.scrollIntoViewIfNeeded()
    await selectClientTab(setup, 'Claude Code Terminal')
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

    // The FAQ accordion is a Reka (client:visible) island whose trigger already
    // renders aria-expanded="false" server-side, so a click can land before the
    // island hydrates. Re-click until it actually toggles.
    const question = page.getByRole('button', {
      name: "What's the server URL?"
    })
    await expect(async () => {
      await question.click()
      await expect(question).toHaveAttribute('aria-expanded', 'true')
    }).toPass()
    await expect(
      page.getByRole('link', { name: MCP_ENDPOINT, exact: true })
    ).toHaveAttribute('href', MCP_ENDPOINT)
  })
})

test.describe('MCP page zh-CN @smoke', () => {
  test('setup section renders localized options', async ({ page }) => {
    await page.goto('/zh-CN/mcp')
    const setup = page.locator('#setup')
    await setup.scrollIntoViewIfNeeded()
    await expect(
      setup.getByRole('heading', { name: '添加自定义连接器' })
    ).toBeVisible()
    await selectClientTab(setup, 'Claude Code Terminal')
    await expect(setup.getByRole('heading', { name: '手动安装' })).toBeVisible()
    await expect(setup.getByText(MCP_ENDPOINT, { exact: true })).toBeVisible()
  })
})
