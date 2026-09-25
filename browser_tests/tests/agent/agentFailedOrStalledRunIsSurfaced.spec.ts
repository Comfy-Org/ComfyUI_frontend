import { expect } from '@playwright/test'

import {
  agentExecutionStoryTest as test,
  runToolCallFrame,
  settleStoryTurn,
  startStoryTurn
} from '@e2e/fixtures/agentExecutionStoryFixture'
import { QueuePanel } from '@e2e/fixtures/components/QueuePanel'
import {
  TARGET_ID,
  WORKFLOW_ID
} from '@e2e/fixtures/data/agent/agentCrdtMultiAutogrowRealignFixture'
import { TestIds } from '@e2e/fixtures/selectors'
import enMessages from '@/locales/en/main.json' with { type: 'json' }

/**
 * User-story matrix rank 99: a failed or stalled job is swallowed and the
 * panel keeps loading (notion-38).
 *
 * The deterministic terminal-state contract: a failure is named to the user
 * on the queue surface, a stall stays a visibly running execution — and in
 * neither case is the agent panel left spinning after its turn ended. What
 * must never happen is the swallow: no visible failure, no visible
 * execution, and a panel that reads as still working on a job that will
 * never finish.
 */
test.describe(
  'Agent failed or stalled run',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test('a failed agent-submitted run surfaces its error and the panel goes idle', async ({
      rig: { harness, execution },
      page
    }) => {
      const jobId = 'agent-surfaced-failed-run-1'
      const failureMessage = 'deterministic fixture failure'
      await startStoryTurn(harness, 'run it')

      // The agent's run tool submits server-side and the turn completes; the
      // failure happens after the agent has already moved on.
      harness.hostSocket.send(runToolCallFrame('running'))
      // Attributed to the bound workflow the way a real cloud job row is.
      await execution.enqueueServerRun(jobId, { workflowId: WORKFLOW_ID })
      await execution.startJob(jobId)
      harness.hostSocket.send(runToolCallFrame('success'))
      await settleStoryTurn(harness)

      await execution.failJob(jobId, {
        nodeId: TARGET_ID,
        message: failureMessage
      })

      // The failure is told to the user, not swallowed: the job's row is
      // still on the queue surface, and its details name the error.
      //
      // Deliberately NOT asserted: the execution error dialog. For a job the
      // browser itself submitted, `execution_error` opens it (see
      // `agentExecutionLifecycle.spec.ts`) — but a server-submitted run
      // bound to an unsaved workflow cannot be attributed to an open
      // workflow (`executionStore.runErrorKeyForJob` resolves no path), so
      // the error is buffered as unattributable and the dialog never opens.
      // Recorded as a finding rather than papered over here.
      const queuePanel = new QueuePanel(page)
      await queuePanel.open()
      const jobRow = queuePanel.jobRow(jobId)
      await expect(jobRow).toBeVisible()
      await jobRow.hover()
      await expect(
        page.getByText(enMessages.queue.jobDetails.errorMessage)
      ).toBeVisible()
      await expect(page.getByText(failureMessage)).toBeVisible()

      // The failure produced no output anywhere...
      await expect(harness.targetNode.locator('img')).toHaveCount(0)
      // ...and the panel is idle, not stuck loading a job that already died.
      await expect(
        harness.panel.getByRole('button', { name: enMessages.agent.stop })
      ).toHaveCount(0)
      await expect(
        harness.panel.getByText(enMessages.agent.thinking)
      ).toHaveCount(0)
    })

    test('a stalled agent-submitted run stays visibly running instead of being swallowed', async ({
      rig: { harness, execution },
      page
    }) => {
      const jobId = 'agent-surfaced-stalled-run-1'
      await startStoryTurn(harness, 'run it')

      // The run stalls server-side: frozen mid-execution, no terminal frame
      // will ever arrive. The agent's turn still ends.
      harness.hostSocket.send(runToolCallFrame('running'))
      await execution.enqueueServerRun(jobId)
      await execution.stallJob(jobId, { nodeId: TARGET_ID })
      harness.hostSocket.send(runToolCallFrame('success'))
      await settleStoryTurn(harness)

      // The stall is visible where execution state lives: the node keeps its
      // executing outline and the queue surface keeps the running row.
      await expect(
        harness.targetNode.getByTestId('node-state-outline-overlay')
      ).toBeVisible()
      const queuePanel = new QueuePanel(page)
      await queuePanel.open()
      await expect(queuePanel.jobRow(jobId)).toBeVisible()

      // No invented terminal state, and no panel stuck loading: the user can
      // see a run that is still going, not a swallowed one.
      await expect(harness.targetNode.locator('img')).toHaveCount(0)
      await expect(page.getByTestId(TestIds.dialogs.errorDialog)).toHaveCount(0)
      await expect(
        harness.panel.getByRole('button', { name: enMessages.agent.stop })
      ).toHaveCount(0)
      await expect(
        harness.panel.getByText(enMessages.agent.thinking)
      ).toHaveCount(0)
    })
  }
)
