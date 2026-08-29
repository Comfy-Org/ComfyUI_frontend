import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import {
  agentTest as test,
  bootAgentApp
} from '@e2e/fixtures/agentPanelFixture'

const OPEN_AGENT_LABEL = enMessages.agent.askComfyAgent
const OPEN_STORAGE_KEY = 'Comfy.AgentPanel.open'

function storedOpenState(page: import('@playwright/test').Page) {
  return page.evaluate((key) => localStorage.getItem(key), OPEN_STORAGE_KEY)
}

/**
 * Toggle app mode the way the shared AppModeHelper does. The exit affordance
 * lives behind different chrome once app mode is on, so driving the command
 * keeps the round trip symmetric.
 */
async function toggleAppMode(page: import('@playwright/test').Page) {
  await page.evaluate(() =>
    window.app!.extensionManager.command.execute('Comfy.ToggleLinear')
  )
}

test.describe('In-App Agent panel dock persistence', { tag: '@cloud' }, () => {
  // PM-630 T-15 / FE-1284 — the open state survives a reload, and the store
  // plants no key at all until the user opens the panel.
  test('restores the open dock after a reload', async ({
    page,
    agentFlagEnabled
  }) => {
    await bootAgentApp(page, agentFlagEnabled)

    const panel = page.getByTestId('docked-agent-panel')
    await expect(panel).toHaveCount(0)
    // writeDefaults: false — a user who never opened the panel keeps a clean
    // localStorage, so absence here is the contract, not merely "not true".
    expect(await storedOpenState(page)).toBeNull()

    await page.getByRole('button', { name: OPEN_AGENT_LABEL }).click()
    await expect(panel).toBeVisible()
    await expect.poll(() => storedOpenState(page)).toBe('true')

    await page.reload()
    await expect(panel).toBeVisible()
    await expect(page.getByTestId('agent-panel-root')).toBeVisible()
    await expect.poll(() => storedOpenState(page)).toBe('true')
  })

  test('keeps the dock closed across a reload once dismissed', async ({
    page,
    agentFlagEnabled
  }) => {
    await bootAgentApp(page, agentFlagEnabled)

    const panel = page.getByTestId('docked-agent-panel')
    await page.getByRole('button', { name: OPEN_AGENT_LABEL }).click()
    await expect(panel).toBeVisible()

    await panel.getByRole('button', { name: enMessages.g.close }).click()
    await expect(panel).toHaveCount(0)
    await expect.poll(() => storedOpenState(page)).toBe('false')

    await page.reload()
    await expect(
      page.getByRole('button', { name: OPEN_AGENT_LABEL })
    ).toBeVisible()
    await expect(panel).toHaveCount(0)
    await expect.poll(() => storedOpenState(page)).toBe('false')
  })

  // PM-630 T-16 / FE-1298 — app mode re-hosts the dock under a different
  // parent; exactly one panel root must survive the round trip.
  test('keeps a single docked panel across an app-mode round trip', async ({
    page,
    agentFlagEnabled
  }) => {
    test.setTimeout(30_000)

    await bootAgentApp(page, agentFlagEnabled)

    const panel = page.getByTestId('docked-agent-panel')
    await page.getByRole('button', { name: OPEN_AGENT_LABEL }).click()
    await expect(panel).toBeVisible()

    await toggleAppMode(page)
    // Re-hosting moves the node rather than duplicating it; a second root
    // would mean two agent sessions mounted at once.
    await expect(panel).toHaveCount(1)
    await expect(panel).toBeVisible()
    await expect(page.getByTestId('agent-panel-root')).toHaveCount(1)

    await toggleAppMode(page)
    await expect(panel).toHaveCount(1)
    await expect(panel).toBeVisible()
    await expect(page.getByTestId('agent-panel-root')).toHaveCount(1)
    await expect.poll(() => storedOpenState(page)).toBe('true')
  })
})
