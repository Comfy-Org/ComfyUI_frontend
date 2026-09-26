import { expect, mergeTests } from '@playwright/test'

import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { webSocketFixture } from '@e2e/fixtures/ws'
import { agentTest } from '@e2e/tests/agent/agentPanelMocks'

import type { AgentRunModePreference } from '@/workbench/extensions/agent/schemas/agentApiSchema'
import { zAgentRunMode } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

// Covers a P1 from Test Plan: 1.54 — Comfy Agent, reproduced 3x by hand:
// "The Run permissions popover does not dismiss on Escape ... It overlays the
// chat input and swallows clicks and keystrokes aimed at it."
const test = mergeTests(agentTest, webSocketFixture)

test.describe('Agent run permissions popover', { tag: '@cloud' }, () => {
  test.use({ connectWebSocketToServer: false })

  // Source: qspec-4 story 94, https://app.notion.com/p/QA-Test-Plan-cloud-1-54-patch-prod-e7901922-to-c378cf82-Agent-backports-3e56d73d3650816f92afe110226eda06
  test('Tab reaches each composer action in its visual order', async ({
    agentPanel,
    comfyPage
  }) => {
    await agentPanel.open()
    await agentPanel.selectWorkflow()
    const panel = agentPanel.root
    const composer = panel.getByRole('textbox', {
      name: new RegExp(enMessages.agent.placeholder.split(',')[0])
    })
    const addToPrompt = panel.getByRole('button', {
      name: enMessages.agent.addToPrompt
    })
    const runMode = panel.getByRole('button', {
      name: enMessages.agent.runModeTriggerAsk,
      exact: true
    })
    const send = panel.getByRole('button', {
      name: enMessages.agent.send,
      exact: true
    })

    await composer.fill('Make the image warmer')
    await composer.focus()
    await comfyPage.page.keyboard.press('Tab')
    await expect(addToPrompt).toBeFocused()
    await comfyPage.page.keyboard.press('Tab')
    await expect(runMode).toBeFocused()
    await comfyPage.page.keyboard.press('Tab')
    await expect(send).toBeFocused()
  })

  // Source: qspec-4 story 95, reports/qa/2026-09-02-a11y.md (A11Y-V1-01), https://github.com/Comfy-Org/ComfyUI_frontend/pull/16596
  test('discloses the expanded state of composer menus', async ({
    agentPanel,
    comfyPage
  }) => {
    await agentPanel.open()
    await agentPanel.selectWorkflow()
    const panel = agentPanel.root
    const addToPrompt = panel.getByRole('button', {
      name: enMessages.agent.addToPrompt
    })
    const runMode = panel.getByRole('button', {
      name: enMessages.agent.runModeTriggerAsk,
      exact: true
    })

    await expect(addToPrompt).toHaveAttribute('aria-expanded', 'false')
    await addToPrompt.click()
    await expect(addToPrompt).toHaveAttribute('aria-expanded', 'true')
    await expect(
      comfyPage.page.getByRole('menuitem', {
        name: enMessages.agent.attachFiles
      })
    ).toBeVisible()

    await comfyPage.page.keyboard.press('Escape')
    await expect(addToPrompt).toHaveAttribute('aria-expanded', 'false')
    await expect(runMode).toHaveAttribute('aria-expanded', 'false')
    await runMode.click()
    await expect(runMode).toHaveAttribute('aria-expanded', 'true')
    await comfyPage.page.keyboard.press('Escape')
    await expect(runMode).toHaveAttribute('aria-expanded', 'false')
  })

  test('Escape dismisses the run permissions popover', async ({
    agentPanel,
    comfyPage
  }) => {
    const page = comfyPage.page

    await agentPanel.open()
    await agentPanel.selectWorkflow()
    const panel = agentPanel.root

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

  // Picking a mode writes it straight through, so arrow keys must not commit.
  // The roving focus that guarantees it only behaves in a real browser.
  test('Arrow keys browse the modes and Enter applies the focused one', async ({
    agentPanel,
    comfyPage
  }) => {
    const page = comfyPage.page
    const savedModes: string[] = []
    await page.route('**/api/agent/run-mode', async (route) => {
      const request = route.request()
      if (request.method() !== 'PUT')
        return route.fulfill(
          jsonRoute({
            mode: 'ask_approval',
            credit_limit: null
          } satisfies AgentRunModePreference)
        )
      const saved = zAgentRunMode.parse(request.postDataJSON())
      savedModes.push(saved.mode)
      return route.fulfill(jsonRoute(saved))
    })

    await agentPanel.open()
    await agentPanel.selectWorkflow()
    const panel = agentPanel.root

    const askTrigger = panel.getByRole('button', {
      name: enMessages.agent.runModeTriggerAsk,
      exact: true
    })
    const askOption = page.getByRole('menuitemradio', {
      name: new RegExp(enMessages.agent.runModeAsk)
    })
    const autoOption = page.getByRole('menuitemradio', {
      name: new RegExp(enMessages.agent.runModeAuto)
    })

    await askTrigger.click()
    await expect(
      page.getByText(enMessages.agent.runPermissions, { exact: true })
    ).toBeVisible()

    await test.step('moving focus leaves the saved mode alone', async () => {
      await page.keyboard.press('ArrowDown')
      await expect(askOption).toBeFocused()
      await page.keyboard.press('ArrowDown')
      await expect(autoOption).toBeFocused()
      await expect(askOption).toBeChecked()
      expect(savedModes).toEqual([])
    })

    await test.step('Enter applies the focused mode with no save step', async () => {
      await page.keyboard.press('Enter')
      await expect(
        panel.getByRole('button', {
          name: enMessages.agent.runModeTriggerAuto,
          exact: true
        })
      ).toBeVisible()
      expect(savedModes).toEqual(['auto'])
    })
  })

  // A rejected write keeps the menu open to retry from, but the options go
  // aria-disabled mid-write: that retry survives only if focus does.
  test('A failed save can be retried from the keyboard', async ({
    agentPanel,
    comfyPage
  }) => {
    const page = comfyPage.page
    const savedModes: string[] = []
    let rejectNext = true
    let rejectTheWrite: () => void = () => {}
    const held = new Promise<void>((resolve) => {
      rejectTheWrite = resolve
    })
    await page.route('**/api/agent/run-mode', async (route) => {
      const request = route.request()
      if (request.method() !== 'PUT')
        return route.fulfill(
          jsonRoute({
            mode: 'ask_approval',
            credit_limit: null
          } satisfies AgentRunModePreference)
        )
      const saved = zAgentRunMode.parse(request.postDataJSON())
      savedModes.push(saved.mode)
      if (rejectNext) {
        rejectNext = false
        await held
        return route.fulfill({ status: 500, body: 'nope' })
      }
      return route.fulfill(jsonRoute(saved))
    })

    await agentPanel.open()
    await agentPanel.selectWorkflow()
    const panel = agentPanel.root
    const autoOption = page.getByRole('menuitemradio', {
      name: new RegExp(enMessages.agent.runModeAuto)
    })

    await panel
      .getByRole('button', {
        name: enMessages.agent.runModeTriggerAsk,
        exact: true
      })
      .click()
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    await expect(autoOption).toBeFocused()

    await test.step('the in-flight write keeps focus on the picked option', async () => {
      await page.keyboard.press('Enter')
      await expect(autoOption).toHaveAttribute('aria-disabled', 'true')
      await expect(autoOption).toHaveAttribute('aria-busy', 'true')
      await expect(autoOption).toBeFocused()
      rejectTheWrite()
    })

    await test.step('the rejected pick keeps the menu, focus and old mode', async () => {
      await expect(
        page.getByText(enMessages.agent.runModeSaveFailed)
      ).toBeVisible()
      await expect(autoOption).toBeFocused()
      await expect(autoOption).not.toBeChecked()
      await expect(autoOption).not.toHaveAttribute('aria-disabled')
      expect(savedModes).toEqual(['auto'])
    })

    await test.step('Enter retries it without re-navigating', async () => {
      await page.keyboard.press('Enter')
      await expect(
        panel.getByRole('button', {
          name: enMessages.agent.runModeTriggerAuto,
          exact: true
        })
      ).toBeVisible()
      expect(savedModes).toEqual(['auto', 'auto'])
    })
  })
})
