import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

/**
 * BE-11470 C1.4 smoke: one real turn through /api/agent against the local
 * integration harness (scripts/dev-agent-integration.ts). Nothing on the
 * agent path is mocked: this file builds on the bare comfyPageFixture and
 * must never compose agentTest/agentPanelMocks or webSocketFixture, whose
 * imports register the agent-route interceptors.
 *
 * The prompt carries a run-unique nonce, echoed to test stdout below, so the
 * agent process's own stdout can be correlated to this exact turn - the one
 * piece of evidence a mock cannot forge. The response is asserted
 * deterministically (a non-error assistant message with non-empty text that
 * finishes streaming); asserting model output content is banned here because
 * the backend is real.
 *
 * Excluded from CI by tag: the panel's local-agent path gates on
 * VITE_AGENT_STANDALONE, which is baked at build time and unset in the CI
 * dist, so this spec can only run under the harness.
 */
test.describe('Agent harness smoke', { tag: '@agent-harness' }, () => {
  test('one unmocked turn yields a non-error assistant reply', async ({
    comfyPage
  }) => {
    test.setTimeout(180_000)
    const page = comfyPage.page

    const nonce = `agent-harness-smoke-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 10)}`
    console.log(`[agent-harness-smoke] nonce=${nonce}`)

    await page
      .getByRole('button', { name: enMessages.agent.askComfyAgent })
      .click()
    const panel = page.locator('#agent-panel-root')
    await expect(panel).toBeVisible()

    const composer = panel.getByRole('textbox', { name: /^Describe ideas/ })
    await composer.fill(
      `Reply with one short sentence acknowledging this session. Nonce: ${nonce}`
    )
    // Enter submits the composer; the CRDT dev-panel chip overlaps the Send
    // button under the harness and intercepts pointer clicks on it.
    await composer.press('Enter')

    // The turn has started once assistant text renders (the Stop affordance
    // is transient and a fast model turn can finish before it is observed);
    // it has finished when Stop is gone again. A real model turn can be slow,
    // so the completion window is generous.
    const assistantText = panel.getByTestId('markdown-stream').last()
    await expect(assistantText).toBeVisible({ timeout: 30_000 })
    const stopButton = panel.getByRole('button', {
      name: enMessages.agent.stop
    })
    await expect(stopButton).toBeHidden({ timeout: 150_000 })
    await expect(assistantText).not.toHaveText('')

    await expect(panel.getByRole('alert')).toHaveCount(0)
  })
})
