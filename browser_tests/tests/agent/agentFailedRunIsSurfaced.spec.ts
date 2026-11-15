import { expect } from '@playwright/test'

import {
  agentExecutionStoryTest as test,
  runToolCallFrame,
  settleStoryTurn,
  startStoryTurn
} from '@e2e/tests/agent/agentExecutionStoryFixture'
import { QueuePanel } from '@e2e/fixtures/components/QueuePanel'
import { TARGET_ID } from '@e2e/fixtures/data/agent/agentCrdtMultiAutogrowRealignFixture'
import { TestIds } from '@e2e/fixtures/selectors'
import enMessages from '@/locales/en/main.json' with { type: 'json' }

test.describe(
  'Agent failed run',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test('a run that fails after the turn ends names its error and leaves the panel idle', async ({
      rig: { harness, execution },
      page
    }) => {
      const jobId = 'agent-surfaced-failed-run-1'
      const failureMessage = 'deterministic fixture failure'
      await startStoryTurn(harness, 'run it')
      harness.hostSocket.send(runToolCallFrame('running'))
      await execution.enqueueServerRun(jobId)
      await execution.startJob(jobId)
      harness.hostSocket.send(runToolCallFrame('success'))
      await settleStoryTurn(harness)

      await execution.failJob(jobId, {
        nodeId: TARGET_ID,
        message: failureMessage
      })

      const queuePanel = new QueuePanel(page)
      await queuePanel.open()
      await queuePanel.jobRow(jobId).hover()
      const details = page.getByTestId(TestIds.queue.jobDetailsPopover)
      await expect(
        details.getByText(enMessages.queue.jobDetails.errorMessage)
      ).toBeVisible()
      await expect(details.getByText(failureMessage)).toBeVisible()
      await expect(
        harness.panel.getByRole('button', { name: enMessages.agent.stop })
      ).toHaveCount(0)
      await expect(
        harness.panel.getByText(enMessages.agent.thinking)
      ).toHaveCount(0)
    })
  }
)
