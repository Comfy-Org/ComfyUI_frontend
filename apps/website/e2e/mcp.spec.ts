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

    await setup.getByRole('tab', { name: 'Claude Code Terminal' }).click()
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
  })

  test('skills plugin link lives in the agent option card', async ({
    page
  }) => {
    const setup = page.locator('#setup')
    await setup.scrollIntoViewIfNeeded()
    await setup.getByRole('tab', { name: 'Claude Code Terminal' }).click()
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

test.describe('MCP page zh-CN @smoke', () => {
  test('setup section renders localized options', async ({ page }) => {
    await page.goto('/zh-CN/mcp')
    const setup = page.locator('#setup')
    await setup.scrollIntoViewIfNeeded()
    await expect(
      setup.getByRole('heading', { name: '添加自定义连接器' })
    ).toBeVisible()
    await setup.getByRole('tab', { name: 'Claude Code Terminal' }).click()
    await expect(setup.getByText('方式一')).toBeVisible()
    await expect(setup.getByRole('heading', { name: '手动安装' })).toBeVisible()
    await expect(setup.getByText(MCP_ENDPOINT, { exact: true })).toBeVisible()
  })
})
