import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { parseAgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'
import { AGENT_PANEL_FLAG } from '@/workbench/extensions/agent/utils/postHogFlagSource'

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
 * piece of evidence a mock cannot forge. The turn is asserted
 * deterministically: assistant text renders and the backend's own
 * agent_message_done frame arrives on the real socket, because a dropped
 * socket leaves the same idle panel as a finished turn. Asserting model
 * output content is banned here because the backend is real.
 *
 * Excluded from CI by tag: the panel's local-agent path gates on
 * VITE_AGENT_STANDALONE, which is baked at build time and unset in the CI
 * dist, so this spec can only run under the harness.
 */

/**
 * Every agent_message_done the backend puts on the agent's own socket, by
 * message id. Registered before the panel opens so the socket's first frames
 * are not missed.
 */
function collectDoneFrames(page: Page): string[] {
  const doneFrames: string[] = []
  page.on('websocket', (socket) => {
    if (!socket.url().includes('/api/agent/events')) return
    socket.on('framereceived', ({ payload }) => {
      const parsed = parseAgentWsEvent(JSON.parse(String(payload)))
      if (parsed.success && parsed.data.type === 'agent_message_done')
        doneFrames.push(parsed.data.data.message_id)
    })
  })
  return doneFrames
}

function runNonce(label: string): string {
  const nonce = `${label}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`
  console.log(`[${label}] nonce=${nonce}`)
  return nonce
}

async function openPanel(page: Page) {
  await page
    .getByRole('button', { name: enMessages.agent.entryButton, exact: true })
    .click()
  const panel = page.locator('#agent-panel-root')
  await expect(panel).toBeVisible()
  return panel
}

async function submitTurn(panel: ReturnType<Page['locator']>, text: string) {
  const composer = panel.getByRole('textbox', { name: /^Describe ideas/ })
  await composer.fill(text)
  // Enter submits the composer; the CRDT dev-panel chip overlaps the Send
  // button under the harness and intercepts pointer clicks on it.
  await composer.press('Enter')
}

test.describe('Agent harness smoke', { tag: '@agent-harness' }, () => {
  test('one unmocked turn streams a reply the backend completes', async ({
    comfyPage
  }) => {
    test.setTimeout(180_000)
    const page = comfyPage.page
    const doneFrames = collectDoneFrames(page)
    const nonce = runNonce('agent-harness-smoke')

    const panel = await openPanel(page)
    await submitTurn(
      panel,
      `Reply with one short sentence acknowledging this session. Nonce: ${nonce}`
    )

    // The turn has started once assistant text renders (the Stop affordance
    // is transient and a fast model turn can finish before it is observed).
    // A real model turn can be slow, so the completion window is generous.
    const assistantText = panel.getByTestId('markdown-stream').last()
    await expect(assistantText).toBeVisible({ timeout: 30_000 })
    await expect.poll(() => doneFrames, { timeout: 150_000 }).toHaveLength(1)
    await expect(
      panel.getByRole('button', { name: enMessages.agent.stop })
    ).toBeHidden()
    await expect(assistantText).not.toHaveText('')
  })

  /**
   * FE #17469: the standalone panel has no cloud identity for PostHog to
   * evaluate the flag against, so the harness build forces it on
   * (extensions/core/agentPanel.ts) - the panel must render with no flag
   * persisted anywhere. And the agent's document frames now ride the SAME
   * socket as the chat stream, so an edit the agent makes must land on the
   * canvas through the follower, not only in the transcript. The node class
   * is asserted through the page's own graph, deterministically: the agent
   * is asked for exactly one node of one class, and the count of that class
   * must rise by exactly one.
   */
  test('renders without the PostHog flag and lands an agent-added node on the canvas', async ({
    comfyPage
  }) => {
    test.setTimeout(180_000)
    const page = comfyPage.page
    const doneFrames = collectDoneFrames(page)
    const nonce = runNonce('agent-harness-canvas')
    const nodeClass = 'EmptyLatentImage'

    // No flag is persisted for this browser: PostHog keeps evaluated flags in
    // its `ph_*` localStorage entries and cookie, so the panel below opens
    // on the harness's forced gate alone.
    const flagPersisted = await page.evaluate(
      (flag) =>
        Object.entries(localStorage).some(
          ([key, value]) => key.startsWith('ph_') && value.includes(flag)
        ) || document.cookie.includes(flag),
      AGENT_PANEL_FLAG
    )
    expect(flagPersisted).toBe(false)
    const panel = await openPanel(page)

    const countNodes = () =>
      page.evaluate(
        (type) =>
          window.app?.rootGraph.nodes.filter((node) => node.type === type)
            .length ?? 0,
        nodeClass
      )
    const before = await countNodes()

    await submitTurn(
      panel,
      `Add exactly one ${nodeClass} node to the canvas and do nothing else. Nonce: ${nonce}`
    )

    // The node arrives through the follower on the shared socket; the done
    // frame proves the backend finished the turn rather than the socket
    // dropping mid-way. Both windows are generous because the model is real.
    await expect.poll(countNodes, { timeout: 150_000 }).toBe(before + 1)
    await expect.poll(() => doneFrames, { timeout: 150_000 }).toHaveLength(1)
    await expect(
      panel.getByRole('button', { name: enMessages.agent.stop })
    ).toBeHidden()
  })
})
