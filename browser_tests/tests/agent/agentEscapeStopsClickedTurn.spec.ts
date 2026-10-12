import { expect, mergeTests } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { webSocketFixture } from '@e2e/fixtures/ws'
import { agentTest } from '@e2e/tests/agent/agentPanelMocks'

// Story 39 of qa/user-story-test-matrix.md (in-app-agent-program):
// "Escape does not stop the turn -- reproduces specifically for a turn
// submitted by clicking Send rather than pressing Enter."
// Sources: regr-26 (PM-1525, PM-1526, PRs 18296 ...), slack-51.
//
// Why the submit path matters, in the product's own words
// (Composer.vue, `handleEscapeOverride`): the prompt editor only forwards
// keydown while the ProseMirror contenteditable itself has focus, so the
// Enter path is caught by the editor-scoped handler. A pointer click on Send
// does not reliably leave focus anywhere that handler can see -- Chrome moves
// it onto the button, Safari and Firefox leave it on <body>. The override in
// `keybindingService` exists for exactly that case.
//
// That override is covered at component level (Composer.test.ts). This is the
// browser-level case the harness-first rule asks for: a real pointer click on
// a real button, real focus behaviour, and the stop judged the way the user
// judges it -- the Stop button is gone and the composer takes a prompt again.
//
// Lands green: a regression guard on a fix that is already in the source.
// It is not a repro of a live bug.

const test = mergeTests(agentTest, webSocketFixture)

const PROMPT = 'Build a rainy city at night'

test.describe(
  'Escape stops a turn that was submitted by clicking Send',
  { tag: '@cloud' },
  () => {
    test.use({ connectWebSocketToServer: false })

    test('the turn stops without the composer ever regaining focus', async ({
      agentPanel,
      postedMessages,
      page
    }) => {
      test.setTimeout(30_000)

      // Stopping a turn means one thing to the user: the work, and the spend,
      // stop. The panel keeps showing Stop until the server confirms (see
      // agentPanel.spec.ts, "edits and resubmits the last prompt after
      // stopping its turn"), so the cancel the panel issues is the observable
      // that separates "Escape stopped it" from "Escape did nothing".
      const cancelled: string[] = []
      await page.route('**/api/agent/threads/*/messages/*/cancel', (route) => {
        cancelled.push(route.request().url())
        return route.fallback()
      })

      await agentPanel.open()
      await agentPanel.selectWorkflow()

      const panel = agentPanel.root
      const stopButton = panel.getByRole('button', {
        name: enMessages.agent.stop
      })

      await test.step('user types a prompt and clicks Send', async () => {
        await agentPanel.composer.fill(PROMPT)
        await agentPanel.sendButton.click()
        await expect.poll(() => postedMessages.length).toBe(1)
        await expect(stopButton).toBeVisible()
      })

      // The distinguishing condition of this story. Asserting it keeps the
      // case honest: if a future change made Send return focus to the editor,
      // the case would silently degrade into the Enter path it is not about.
      await test.step('focus is not inside the prompt editor', async () => {
        await expect(agentPanel.composer).not.toBeFocused()
      })

      await test.step('user presses Escape', async () => {
        await page.keyboard.press('Escape')
      })

      await test.step('the turn is cancelled', async () => {
        await expect
          .poll(() => cancelled.length, {
            message:
              'Escape after a clicked Send did not cancel the running turn'
          })
          .toBe(1)
      })
    })
  }
)
