import { expect } from '@playwright/test'

import {
  agentExecutionStoryTest as test,
  runToolCallFrame,
  settleStoryTurn,
  startStoryTurn
} from '@e2e/fixtures/agentExecutionStoryFixture'
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
      await startStoryTurn(harness, 'run it')
      harness.hostSocket.send(runToolCallFrame('running'))
      await execution.enqueueServerRun(jobId)
      await execution.stallJob(jobId, { nodeId: TARGET_ID })
      const executingOutline = harness.targetNode.getByTestId(
        'node-state-outline-overlay'
      )
      await expect(executingOutline).toBeVisible()

      await Promise.all([
        page.waitForRequest('**/api/agent/threads/*/messages/*/cancel'),
        harness.panel
          .getByRole('button', { name: enMessages.agent.stop })
          .click()
      ])
      await settleStoryTurn(harness)

      await expect(executingOutline).toBeVisible()
      expect(execution.jobCancelRequests()).toEqual([])
    })
  }
)
