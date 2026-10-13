import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { parseServerDocFrame } from '@/workbench/extensions/agent/crdt/docFrameClient'
import { parseAgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { AGENT_SOCKET_URL } from '@e2e/fixtures/agentSocket'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'

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

function collectAgentFrames(page: Page): {
  docUpdates: () => number
  doneMessageIds: string[]
} {
  let docUpdates = 0
  const doneMessageIds: string[] = []
  page.on('websocket', (socket) => {
    if (!AGENT_SOCKET_URL.test(socket.url())) return
    socket.on('framereceived', ({ payload }) => {
      const frame: unknown = JSON.parse(String(payload))
      const parsed = parseAgentWsEvent(frame)
      if (parsed.success && parsed.data.type === 'agent_message_done')
        doneMessageIds.push(parsed.data.data.message_id)
      else if (parseServerDocFrame(frame)?.type === 'doc_update')
        docUpdates += 1
    })
  })
  return { docUpdates: () => docUpdates, doneMessageIds }
}

function runNonce(label: string): string {
  const nonce = `${label}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`
  console.log(`[${label}] nonce=${nonce}`)
  return nonce
}

async function submitTurn(agentPanel: AgentPanel, text: string) {
  await agentPanel.composer.fill(text)
  await agentPanel.composer.press('Enter')
}

test.describe('Agent harness smoke', { tag: '@agent-harness' }, () => {
  test('one unmocked turn streams a reply the backend completes', async ({
    comfyPage
  }) => {
    test.setTimeout(180_000)
    const { doneMessageIds } = collectAgentFrames(comfyPage.page)
    const nonce = runNonce('agent-harness-smoke')

    const agentPanel = new AgentPanel(comfyPage.page)
    const panel = await agentPanel.open()
    await submitTurn(
      agentPanel,
      `Reply with one short sentence acknowledging this session. Nonce: ${nonce}`
    )

    // The turn has started once assistant text renders (the Stop affordance
    // is transient and a fast model turn can finish before it is observed).
    // A real model turn can be slow, so the completion window is generous.
    const assistantText = panel.getByTestId('markdown-stream').last()
    await expect(assistantText).toBeVisible({ timeout: 30_000 })
    await expect
      .poll(() => doneMessageIds, { timeout: 150_000 })
      .toHaveLength(1)
    await expect(agentPanel.stopButton).toBeHidden()
    await expect(assistantText).not.toHaveText('')
  })

  test('lands an agent-added node on the canvas over the agent socket', async ({
    comfyPage
  }) => {
    test.setTimeout(180_000)
    const { docUpdates, doneMessageIds } = collectAgentFrames(comfyPage.page)
    const nonce = runNonce('agent-harness-canvas')
    const nodeClass = 'EmptyLatentImage'

    const agentPanel = new AgentPanel(comfyPage.page)
    await agentPanel.open()
    const countNodes = async () =>
      (await comfyPage.nodeOps.getNodeRefsByType(nodeClass)).length
    const before = await countNodes()

    await submitTurn(
      agentPanel,
      `Add one ${nodeClass} node to the canvas. Nonce: ${nonce}`
    )

    await expect
      .poll(() => doneMessageIds, { timeout: 150_000 })
      .toHaveLength(1)
    await expect.poll(docUpdates).toBeGreaterThan(0)
    await expect.poll(countNodes).toBeGreaterThan(before)
    await expect(agentPanel.stopButton).toBeHidden()
  })
})
