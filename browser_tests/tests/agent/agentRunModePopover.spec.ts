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

  // PM-1660/PM-1661, reproduced from the reporter's recording: the composer
  // clears on the send CLICK, but the POST that carries the message waits on
  // the cloud-workflow refresh first. The server pins a turn's run mode when
  // that POST arrives, so a mode written inside that window re-authorized a
  // turn the user had already sent under the previous mode.
  test('a mode picked while a message is still in flight is saved after it', async ({
    agentPanel,
    comfyPage
  }) => {
    const page = comfyPage.page
    const reachedServer: string[] = []
    let holdTheSend = false
    let releaseTheSend: () => void = () => {}
    const sendHeld = new Promise<void>((resolve) => {
      releaseTheSend = resolve
    })

    // Both halves of the send are held. Holding the workflow refresh alone
    // would not be enough: prepareWorkflow() abandons it after
    // PREPARE_TIMEOUT_MS and issues the POST anyway, which then waits here.
    await page.route('**/api/workflows?*', async (route) => {
      if (holdTheSend) await sendHeld
      await route.fallback()
    })
    await page.route('**/api/agent/threads/*/messages', async (route) => {
      if (route.request().method() !== 'POST') return route.fallback()
      // Recorded where the POST is FORWARDED, not where it is intercepted.
      // Recording on interception would let a PUT that overtook a still-held
      // POST still read back as ['message', 'run-mode'] and pass.
      if (holdTheSend) await sendHeld
      reachedServer.push('message')
      await route.fallback()
    })
    await page.route('**/api/agent/run-mode', async (route) => {
      const request = route.request()
      if (request.method() !== 'PUT')
        return route.fulfill(
          jsonRoute({
            mode: 'auto',
            credit_limit: null
          } satisfies AgentRunModePreference)
        )
      reachedServer.push('run-mode')
      return route.fulfill(
        jsonRoute(zAgentRunMode.parse(request.postDataJSON()))
      )
    })

    await agentPanel.open()
    await agentPanel.selectWorkflow()
    const panel = agentPanel.root
    const askTrigger = panel.getByRole('button', {
      name: enMessages.agent.runModeTriggerAsk,
      exact: true
    })
    const autoTrigger = panel.getByRole('button', {
      name: enMessages.agent.runModeTriggerAuto,
      exact: true
    })
    await expect(autoTrigger).toBeVisible()

    holdTheSend = true
    await agentPanel.sendMessage('run the wf')

    await test.step('the composer looks sent while the send is still held', async () => {
      await expect(agentPanel.composer).toHaveText('')
    })

    await test.step('switching mode now does not overtake the message', async () => {
      await autoTrigger.click()
      await page
        .getByRole('menuitemradio', {
          name: new RegExp(enMessages.agent.runModeAsk)
        })
        .click()

      // A cheap sanity guard, not the regression detector: reachedServer is
      // pushed from a Node-side route handler, which the DOM assertion above
      // it does not order against. The detector is the final assertion.
      // Nothing at all should have been forwarded while the send is held.
      await expect(
        page.getByRole('menuitemradio', {
          name: new RegExp(enMessages.agent.runModeAsk)
        })
      ).toHaveAttribute('aria-busy', 'true')
      expect(reachedServer).toEqual([])

      releaseTheSend()
      await expect(askTrigger).toBeVisible()
      // The load-bearing assertion: the write landed, and it landed second.
      await expect.poll(() => reachedServer).toEqual(['message', 'run-mode'])
    })
  })
})
