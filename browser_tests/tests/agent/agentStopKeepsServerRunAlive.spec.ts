import { expect } from '@playwright/test'

import type { AgentCancelAccepted } from '@comfyorg/ingest-types'

import {
  agentExecutionStoryTest as test,
  runToolCallFrame,
  settleStoryTurn,
  startStoryTurn
} from '@e2e/fixtures/agentExecutionStoryFixture'
import { QueuePanel } from '@e2e/fixtures/components/QueuePanel'
import { TARGET_ID } from '@e2e/fixtures/data/agent/agentCrdtMultiAutogrowRealignFixture'
import { TestIds } from '@e2e/fixtures/selectors'
import enMessages from '@/locales/en/main.json' with { type: 'json' }

const JOB_ID = 'agent-stop-survivor-run-1'

/**
 * User-story matrix rank 41: stopping the agent does not stop the job it
 * already submitted.
 *
 * Stop cancels the agent's TURN — the job the run tool already submitted
 * server-side keeps running, keeps its place in the queue, and keeps spending.
 * The guard: after the user stops the turn and the turn settles, the run is
 * still visibly in flight (executing outline, running queue row) and no
 * terminal state has been invented for it. Evidence for the story is
 * langfuse-8: of 123 cancelled turns, 42 had already acted at cancel time.
 */
test.describe(
  'Agent stop vs submitted job',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test('stopping the agent leaves its submitted job running', async ({
      rig: { harness, execution },
      page
    }) => {
      // Stop posts a cancel for the live message; the turn then settles from
      // the host with the canonical `agent_message_done`.
      const cancels: string[] = []
      await page.route('**/api/agent/threads/*/messages/*/cancel', (route) => {
        cancels.push(route.request().url())
        const accepted: AgentCancelAccepted = { status: 'cancelling' }
        return route.fulfill({
          status: 202,
          contentType: 'application/json',
          body: JSON.stringify(accepted)
        })
      })

      await startStoryTurn(harness, 'run it')

      // Mid-turn, the agent's run tool has already submitted a job that is
      // now visibly running: frozen at a mid-execution step, no terminal
      // frame will ever arrive for it.
      harness.hostSocket.send(runToolCallFrame('running'))
      await execution.enqueueServerRun(JOB_ID)
      await execution.stallJob(JOB_ID, { nodeId: TARGET_ID })
      await expect(
        harness.targetNode.getByTestId('node-state-outline-overlay')
      ).toBeVisible()

      // The user stops the agent, and the turn ends.
      await harness.panel
        .getByRole('button', { name: enMessages.agent.stop })
        .click()
      await expect.poll(() => cancels.length).toBe(1)
      await settleStoryTurn(harness)

      // The job the agent already submitted is untouched by the stop: still
      // visibly executing on the node, still a running row on the queue
      // surface, and no terminal state — no output, no error dialog.
      await expect(
        harness.targetNode.getByTestId('node-state-outline-overlay')
      ).toBeVisible()
      const queuePanel = new QueuePanel(page)
      await queuePanel.open()
      await expect(queuePanel.jobRow(JOB_ID)).toBeVisible()
      await expect(harness.targetNode.locator('img')).toHaveCount(0)
      await expect(page.getByTestId(TestIds.dialogs.errorDialog)).toHaveCount(0)
    })
  }
)
