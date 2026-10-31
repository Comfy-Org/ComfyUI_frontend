import { expect } from '@playwright/test'

import {
  agentExecutionStoryTest as test,
  runToolCallFrame,
  settleStoryTurn,
  startStoryTurn
} from '@e2e/tests/agent/agentExecutionStoryFixture'
import { QueuePanel } from '@e2e/fixtures/components/QueuePanel'
import { nextFrame } from '@e2e/fixtures/utils/timing'
import { TARGET_ID } from '@e2e/fixtures/data/agent/agentCrdtMultiAutogrowRealignFixture'
import enMessages from '@/locales/en/main.json' with { type: 'json' }

test.describe(
  'Agent stop vs submitted job',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test('stopping the agent cancels its turn but not the job it submitted', async ({
      rig: { harness, execution },
      page
    }) => {
      const jobId = 'agent-stop-survivor-run-1'
      const executingOutline = harness.targetNode.getByTestId(
        'node-state-outline-overlay'
      )

      await test.step('the agent is mid-run on a job it submitted server-side', async () => {
        await startStoryTurn(harness, 'run it')
        harness.hostSocket.send(runToolCallFrame('running'))
        await execution.enqueueServerRun(jobId)
        await execution.stallJob(jobId, { nodeId: TARGET_ID })
        await expect(executingOutline).toBeVisible()
      })

      await test.step('the user stops the agent', async () => {
        await Promise.all([
          page.waitForResponse('**/api/agent/threads/*/messages/*/cancel'),
          harness.panel
            .getByRole('button', { name: enMessages.agent.stop })
            .click()
        ])
        await settleStoryTurn(harness)
        await nextFrame(page)
      })

      await test.step('the job it submitted is still running, uncancelled', async () => {
        await expect(executingOutline).toBeVisible()
        const queuePanel = new QueuePanel(page)
        await queuePanel.open()
        await expect(queuePanel.jobRow(jobId)).toBeVisible()
        // Nothing asked the server to stop the job. The recorder is proven
        // non-vacuous by a positive control, so an empty list is a real
        // observation rather than an unrouted request.
        expect(execution.jobCancelRequests()).toEqual([])
      })
    })
  }
)
