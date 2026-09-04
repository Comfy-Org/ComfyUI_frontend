import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import {
  agentTest as test,
  bootAgentApp
} from '@e2e/fixtures/agentPanelFixture'

const OPEN_AGENT_LABEL = enMessages.agent.askComfyAgent
const OPEN_STORAGE_KEY = 'Comfy.AgentPanel.open'

test.describe(
  'In-App Agent panel lifecycle and accessibility',
  { tag: ['@cloud', '@agent', '@ui'] },
  () => {
    test('preserves the stored preference while the flag is off', async ({
      page
    }) => {
      await page.addInitScript((key) => {
        localStorage.setItem(key, 'true')
      }, OPEN_STORAGE_KEY)
      await bootAgentApp(page, false)

      const actions = page.getByTestId('integrated-tab-bar-actions')
      await expect(actions).toHaveAttribute('data-agent-gate-settled', 'true', {
        timeout: 8_000
      })
      await expect(
        page.getByRole('button', { name: OPEN_AGENT_LABEL })
      ).toHaveCount(0)
      await expect(page.getByTestId('docked-agent-panel')).toHaveCount(0)
      await expect
        .poll(() =>
          page.evaluate((key) => localStorage.getItem(key), OPEN_STORAGE_KEY)
        )
        .toBe('true')
    })

    test('persists open and closed state and exposes pressed state', async ({
      page
    }) => {
      await bootAgentApp(page, true)

      const openButton = page.getByRole('button', { name: OPEN_AGENT_LABEL })
      const panel = page.getByTestId('docked-agent-panel')

      await expect(openButton).toHaveAttribute('aria-pressed', 'false')
      await openButton.click()
      await expect(panel).toBeVisible()
      await expect(openButton).toHaveAttribute('aria-pressed', 'true')
      await expect
        .poll(() =>
          page.evaluate((key) => localStorage.getItem(key), OPEN_STORAGE_KEY)
        )
        .toBe('true')

      await panel.getByRole('button', { name: enMessages.g.close }).click()
      await expect(panel).toHaveCount(0)
      await expect(openButton).toHaveAttribute('aria-pressed', 'false')
      await expect
        .poll(() =>
          page.evaluate((key) => localStorage.getItem(key), OPEN_STORAGE_KEY)
        )
        .toBe('false')
    })

    test.fixme('supports keyboard activation and returns one complementary landmark', async ({
      page
    }) => {
      await bootAgentApp(page, true)

      const openButton = page.getByRole('button', { name: OPEN_AGENT_LABEL })
      await openButton.focus()
      await openButton.press('Enter')

      const panel = page.getByTestId('docked-agent-panel')
      await expect(panel).toBeVisible()
      await expect(panel).toHaveAttribute('role', 'complementary')
      await expect(panel).toHaveAttribute(
        'aria-labelledby',
        'agent-panel-title'
      )
      await expect(page.locator('#agent-panel-title')).toHaveCount(1)
      await expect(page.getByRole('complementary')).toHaveCount(1)

      await panel
        .getByRole('button', { name: enMessages.g.close })
        .press('Enter')
      await expect(panel).toHaveCount(0)
      await expect(openButton).toHaveAttribute('aria-pressed', 'false')
    })

    test('keeps the dock within the viewport and its documented width cap', async ({
      page
    }) => {
      await bootAgentApp(page, true)

      await page.getByRole('button', { name: OPEN_AGENT_LABEL }).click()
      const panel = page.getByTestId('docked-agent-panel')
      await expect(panel).toBeVisible()

      await expect
        .poll(async () => (await panel.boundingBox())?.width ?? 0)
        .toBeGreaterThan(0)

      const box = await panel.boundingBox()
      const viewport = page.viewportSize()
      expect(box).not.toBeNull()
      expect(viewport).not.toBeNull()
      expect(box!.width).toBeGreaterThan(0)
      expect(box!.width).toBeLessThanOrEqual(420)
      expect(box!.x).toBeGreaterThanOrEqual(-1)
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1)
      await expect(page.getByTestId('integrated-tab-bar-actions')).toBeVisible()
    })

    test('restores an open panel after a browser reload', async ({ page }) => {
      await bootAgentApp(page, true)

      await page.getByRole('button', { name: OPEN_AGENT_LABEL }).click()
      await expect(page.getByTestId('docked-agent-panel')).toBeVisible()
      await expect
        .poll(() =>
          page.evaluate((key) => localStorage.getItem(key), OPEN_STORAGE_KEY)
        )
        .toBe('true')

      await page.reload()
      await expect(
        page.getByTestId('integrated-tab-bar-actions')
      ).toHaveAttribute('data-agent-gate-settled', 'true', { timeout: 8_000 })
      await expect(page.getByTestId('docked-agent-panel')).toBeVisible()
      await expect(
        page.getByRole('button', { name: OPEN_AGENT_LABEL })
      ).toHaveAttribute('aria-pressed', 'true')
    })

    test('keeps one Agent panel mounted while switching workflow tabs', async ({
      page,
      agentFlagEnabled
    }) => {
      await bootAgentApp(page, agentFlagEnabled)

      const openButton = page.getByRole('button', { name: OPEN_AGENT_LABEL })
      await openButton.click()

      const panel = page.getByTestId('docked-agent-panel')
      const tabs = page.locator('.workflow-tabs .p-togglebutton')
      await expect(panel).toBeVisible()
      await expect(tabs).toHaveCount(1)

      await page.locator('.new-blank-workflow-button').click()
      await expect(tabs).toHaveCount(2)
      await tabs.first().click()

      await expect(panel).toHaveCount(1)
      await expect(panel).toBeVisible()
    })
  }
)
