import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'

const OPEN_AGENT_LABEL = enMessages.agent.askComfyAgent

test.describe('In-App Agent panel across view modes', { tag: '@cloud' }, () => {
  test('keeps a single docked panel root when toggling app mode and back', async ({
    comfyPage
  }) => {
    test.setTimeout(30_000)

    const page = comfyPage.page
    const panelRoot = page.locator('#agent-panel-root')

    const openButton = page.getByRole('button', { name: OPEN_AGENT_LABEL })
    await expect(openButton).toBeVisible()
    await openButton.click()

    await expect(panelRoot).toHaveCount(1)
    await expect(panelRoot).toBeVisible()

    // Enter app mode: the docked panel re-hosts under LinearView.
    await comfyPage.appMode.toggleAppMode()
    await expect(panelRoot).toHaveCount(1)
    await expect(panelRoot).toBeVisible()

    // Return to graph mode: the docked panel re-hosts under GraphCanvas.
    await comfyPage.appMode.toggleAppMode()
    await expect(panelRoot).toHaveCount(1)
    await expect(panelRoot).toBeVisible()
  })
})
