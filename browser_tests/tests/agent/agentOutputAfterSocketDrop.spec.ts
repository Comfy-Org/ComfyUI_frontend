import { expect } from '@playwright/test'

import { agentExecutionTest as test } from '@e2e/fixtures/agentExecutionFixture'
import { SOURCE_NODE_ID } from '@e2e/fixtures/data/agent/agentCrdtMultiAutogrowRealignFixture'

const OUTPUT_FILENAME = 'agent-run-finished-offline.png'

test.describe(
  'PM-2123 repro: a run that finishes while /ws is down',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.fail(
      true,
      'PM-2123: a reconnect refreshes the queue but never restores the outputs whose executed frame was lost, so the image only appears after a page reload'
    )

    test('shows the output on its node once the socket reconnects', async ({
      rig: { harness, execution }
    }) => {
      const jobId = 'agent-exec-server-run-pm-2123'

      await test.step('the agent starts a run on the server', async () => {
        await execution.enqueueServerRun(jobId)
        await execution.startJob(jobId)
      })

      await test.step('the socket drops and the run finishes while it is down', async () => {
        const connectionsBeforeDrop =
          harness.hostSocket.executionConnectionCount()
        await execution.recordCompletedJob(jobId, {
          nodeId: String(SOURCE_NODE_ID),
          filename: OUTPUT_FILENAME
        })
        await harness.hostSocket.dropExecutionSocket()
        await expect
          .poll(() => harness.hostSocket.executionConnectionCount())
          .toBeGreaterThan(connectionsBeforeDrop)
      })

      await test.step('the finished output is on its node without a reload', async () => {
        const nodeImage = harness.outputImage(SOURCE_NODE_ID)
        await expect(nodeImage).toBeVisible({ timeout: 10_000 })
        await expect(nodeImage).toHaveAttribute(
          'src',
          new RegExp(OUTPUT_FILENAME.replace('.', '\\.'))
        )
      })
    })
  }
)
