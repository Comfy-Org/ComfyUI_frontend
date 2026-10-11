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
    // A plain string, not a RegExp: the locale text goes into the pattern
    // unescaped, so a `(`, `?` or `+` in a translation would change or break
    // the match. Playwright's non-exact `name` already does a
    // case-insensitive substring match, which is what this needs.
    const composer = panel.getByRole('textbox', {
      name: enMessages.agent.placeholder.split(',')[0]
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

    await expect(composer).toBeVisible()
    await expect(addToPrompt).toBeVisible()
    await expect(runMode).toBeVisible()
    await expect(send).toBeVisible()
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
    // Deliberately NOT getByRole: while the modal menu is open the composer
    // subtree leaves the accessibility tree, and Playwright's role engine
    // excludes anything hidden from it — so a role locator resolves 0 elements
    // exactly when this case needs to read `aria-expanded="true"`. getByLabel
    // matches the `aria-label` attribute directly and keeps resolving, so it
    // carries the trigger through the whole closed → open → closed transition.
    // Measured, both arms, rather than assumed: an ancestor `aria-hidden` (and
    // `display: none`) takes getByRole to 0 while getByLabel stays at 1 and
    // still reads the attribute.
    const addToPrompt = panel.getByLabel(enMessages.agent.addToPrompt, {
      exact: true
    })
    // getByRole here and getByLabel above is not an inconsistency: each
    // locator matches what its own component exposes, and swapping either one
    // resolves 0 elements. `RunModePopover.vue` passes `:modal="false"` to
    // `DropdownMenuRoot`, so opening it does not aria-hide the composer and
    // the role locator keeps resolving — while its trigger's accessible name
    // comes from a `<span>` text node with no `aria-label`, so getByLabel
    // cannot find it at all. `ComposerAddMenu.vue` is the mirror image:
    // modal by default, and its trigger carries
    // `:aria-label="t('agent.addToPrompt')"`. If the run-mode popover ever
    // becomes modal, this locator is what breaks first.
    const runMode = panel.getByRole('button', {
      name: enMessages.agent.runModeTriggerAsk,
      exact: true
    })
    const attachFiles = comfyPage.page.getByRole('menuitem', {
      name: enMessages.agent.attachFiles
    })

    await expect(addToPrompt).toBeVisible()
    await expect(runMode).toBeVisible()

    await expect(addToPrompt).toHaveAttribute('aria-expanded', 'false')
    await addToPrompt.click()
    await expect(addToPrompt).toHaveAttribute('aria-expanded', 'true')
    await expect(attachFiles).toBeVisible()

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

  // Regression coverage for https://github.com/Comfy-Org/ComfyUI_frontend/pull/20177:
  // auth diagnostics must leave the rejected write retryable at the UI.
  test('An auth-rejected save can be retried from the keyboard', async ({
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
        return route.fulfill({
          ...jsonRoute({
            accepted: ['bearer_jwt', 'x_api_key'],
            error: {
              type: 'auth_type_not_allowed',
              message:
                'Authentication method not allowed for this endpoint. Accepted: bearer_jwt, x_api_key'
            }
          }),
          status: 403
        })
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
        comfyPage.toast.withText(enMessages.agent.runModeSaveFailed)
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

  // PM-1660/PM-1661, reproduced from the reporter's recording: the POST that
  // carries the message waits on the cloud-workflow refresh first. The server
  // pins a turn's run mode when that POST arrives, so a mode written inside
  // that window re-authorized a turn sent under the previous mode.
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
      await route.fallback()
      reachedServer.push('message')
    })
    await page.route('**/api/agent/run-mode', async (route) => {
      const request = route.request()
      // ask_approval, which is also agentRunModeStore's own default, so the
      // starting mode does not depend on this route winning a race.
      // DockedAgentPanel fires load() on setup, and asserting a mode only this
      // mock can produce was right about one attempt in four: it failed the
      // initial run and two retries in CI and was reported 'flaky' only
      // because a fourth attempt passed.
      if (request.method() !== 'PUT')
        return route.fulfill(
          jsonRoute({
            mode: 'ask_approval',
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
    await expect(askTrigger).toBeVisible()

    holdTheSend = true
    await agentPanel.sendMessage('run the wf')

    // Picked in the ESCALATING direction: the turn was sent under
    // ask_approval, so a PUT that overtook it would let an already-sent turn
    // run without a consent card.
    await test.step('switching mode now does not overtake the message', async () => {
      await askTrigger.click()
      await page
        .getByRole('menuitemradio', {
          name: new RegExp(enMessages.agent.runModeAuto)
        })
        .click()

      // A cheap sanity guard, not the regression detector: reachedServer is
      // pushed from a Node-side route handler, which the DOM assertion above
      // it does not order against. The detector is the final assertion.
      // Nothing at all should have been forwarded while the send is held.
      await expect(
        page.getByRole('menuitemradio', {
          name: new RegExp(enMessages.agent.runModeAuto)
        })
      ).toHaveAttribute('aria-busy', 'true')
      expect(reachedServer).toEqual([])

      releaseTheSend()
      await expect(autoTrigger).toBeVisible()
      // The load-bearing assertion: the write landed, and it landed second.
      await expect.poll(() => reachedServer).toEqual(['message', 'run-mode'])
    })
  })
})
