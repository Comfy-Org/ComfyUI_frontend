import { expect } from '@playwright/test'

import { agentExecutionTest as test } from '@e2e/fixtures/agentExecutionFixture'
import { SOURCE_NODE_ID } from '@e2e/fixtures/data/agent/agentCrdtMultiAutogrowRealignFixture'

const OUTPUT_FILENAME = 'agent-run-finished-offline.png'
const OUTPUT_SRC = /agent-run-finished-offline\.png/

test.describe(
  'PM-2123: a run that finishes while /ws is down',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test('shows the output on its node once the socket reconnects', async ({
      rig: { harness, execution }
    }) => {
      const jobId = 'agent-exec-server-run-pm-2123'

      await test.step('the agent starts a run on the server', async () => {
        await execution.enqueueServerRun(jobId)
        await execution.startJob(jobId)
      })

      await test.step('the run finishes without a frame, then the socket drops', async () => {
        await execution.recordCompletedJob(jobId, {
          nodeId: String(SOURCE_NODE_ID),
          filename: OUTPUT_FILENAME
        })
        const connectionsBeforeDrop = harness.hostSocket.comfyConnectionCount()
        await harness.hostSocket.disconnectComfySocket()
        await expect
          .poll(() => harness.hostSocket.comfyConnectionCount())
          .toBeGreaterThan(connectionsBeforeDrop)
      })

      await test.step('the finished output is on its node without a reload', async () => {
        const nodeImage = harness.outputImage(SOURCE_NODE_ID)
        await expect(nodeImage).toBeVisible()
        await expect(nodeImage).toHaveAttribute('src', OUTPUT_SRC)
      })
    })
  }
)
