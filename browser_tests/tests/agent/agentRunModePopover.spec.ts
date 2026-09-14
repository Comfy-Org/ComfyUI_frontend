import { expect, mergeTests } from '@playwright/test'

import { webSocketFixture } from '@e2e/fixtures/ws'
import {
  agentTest,
  selectAgentWorkflow
} from '@e2e/tests/agent/agentPanelMocks'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

// Covers a P1 from Test Plan: 1.54 — Comfy Agent, reproduced 3x by hand:
// "The Run permissions popover does not dismiss on Escape ... It overlays the
// chat input and swallows clicks and keystrokes aimed at it."
const test = mergeTests(agentTest, webSocketFixture)

const OPEN_AGENT_LABEL = enMessages.agent.askComfyAgent

test.describe('Agent run permissions popover', { tag: '@cloud' }, () => {
  test.use({ connectWebSocketToServer: false })

  test('Escape dismisses the run permissions popover', async ({
    comfyPage
  }) => {
    const page = comfyPage.page

    const openButton = page.getByRole('button', { name: OPEN_AGENT_LABEL })
    await expect(openButton).toBeVisible()
    await openButton.click()

    const panel = page.locator('#agent-panel-root')
    await expect(panel).toBeVisible()
    await selectAgentWorkflow(page)

    // The popover renders through a portal, so it is addressed from the page
    // rather than from inside the panel.
    const popoverHeading = page.getByText(enMessages.agent.runPermissions, {
      exact: true
    })
    const trigger = panel.getByRole('button', {
      name: enMessages.agent.runModeTriggerAsk,
      exact: true
    })

    // Without this, "hidden after Escape" would also pass for a popover that
    // never opened in the first place.
    await expect(popoverHeading).toBeHidden()

    await test.step('The trigger opens the popover', async () => {
      await expect(trigger).toBeVisible()
      await trigger.click()
      await expect(popoverHeading).toBeVisible()
    })

    await test.step('Escape dismisses it', async () => {
      // Sent through the page: focus is inside the portalled popover, not on
      // the trigger or the panel.
      await page.keyboard.press('Escape')
      await expect(popoverHeading).toBeHidden()
    })
  })
})
