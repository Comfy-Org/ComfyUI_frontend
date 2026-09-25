import { expect } from '@playwright/test'

import { agentTest } from '@e2e/fixtures/agentPanelFixture'
import type { AgentExecutionRig } from '@e2e/fixtures/agentExecutionFixture'
import { AgentExecutionHelper } from '@e2e/fixtures/helpers/AgentExecutionHelper'
import { MultiAutogrowRealignHarness } from '@e2e/fixtures/helpers/MultiAutogrowRealignHarness'
import {
  MESSAGE_ID,
  THREAD_ID
} from '@e2e/fixtures/data/agent/agentCrdtMultiAutogrowRealignFixture'
import enMessages from '@/locales/en/main.json' with { type: 'json' }

/**
 * The execution rig of `agentExecutionFixture`, but with no turn sent yet:
 * the harness's message mock serves exactly one `message_id`, so a user-story
 * spec whose subject IS a turn — "run it", or stopping one mid-flight — must
 * drive that turn itself rather than spend the only one on a binding
 * handshake. The panel is open and targeting the workflow; sending the
 * story's message is what acks the turn and binds the CRDT follower.
 */
export const agentExecutionStoryTest = agentTest.extend<{
  rig: AgentExecutionRig
}>({
  rig: async ({ page }, use) => {
    const harness = new MultiAutogrowRealignHarness(page)
    await harness.setUp({ settings: { 'Comfy.Queue.QPOV2': false } })
    const execution = new AgentExecutionHelper(page, harness.hostSocket)
    await execution.install()
    await harness.targetActiveWorkflow()
    await use({ harness, execution })
  }
})

/**
 * Sends the story's user message and waits until the turn is live: the
 * assistant placeholder is rendered (`agent_message_done` is only routed while
 * the store holds the ack's `message_id`), the turn's ack has bound the CRDT
 * follower, and the workflow the agent would run is visible on the canvas.
 */
export async function startStoryTurn(
  harness: MultiAutogrowRealignHarness,
  text: string
): Promise<void> {
  await harness.panel
    .getByRole('textbox', { name: /^Describe ideas/ })
    .fill(text)
  await harness.panel
    .getByRole('button', { name: enMessages.agent.send })
    .click()
  await expect(
    harness.panel.getByText(enMessages.agent.thinking).first()
  ).toBeVisible()
  await harness.hostSocket.waitForSubscribe()
  await expect(harness.targetNode).toBeVisible()
}

/** Ends the live turn from the host and waits for the panel to go idle. */
export async function settleStoryTurn(
  harness: MultiAutogrowRealignHarness
): Promise<void> {
  harness.hostSocket.send({
    type: 'agent_message_done',
    data: { message_id: MESSAGE_ID, thread_id: THREAD_ID }
  })
  await expect(
    harness.panel.getByRole('button', { name: enMessages.agent.stop })
  ).toHaveCount(0)
}

/** The agent's `run` tool call frame, `running` or settled. */
export function runToolCallFrame(status: 'running' | 'success') {
  return {
    type: 'agent_tool_call' as const,
    data: {
      tool_call_id: 'call-run',
      tool_name: 'run',
      status,
      ...(status === 'success' && { duration_ms: 1200 }),
      message_id: MESSAGE_ID,
      thread_id: THREAD_ID
    }
  }
}
