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
      rig: { harness, execution },
      page
    }) => {
      const jobId = 'agent-exec-server-run-pm-2123'

      await test.step('the agent starts a run on the server', async () => {
        await execution.enqueueServerRun(jobId)
        await execution.startJob(jobId)
      })

      await test.step('the socket drops and the run finishes while it is down', async () => {
        const connectionsBeforeDrop =
          harness.hostSocket.executionConnectionCount()
        await harness.hostSocket.dropExecutionSocket()
        await execution.recordCompletedJob(jobId, {
          nodeId: String(SOURCE_NODE_ID),
          filename: OUTPUT_FILENAME
        })
        const jobsSeenAfterReconnect: string[] = []
        page.on('response', async (response) => {
          if (
            harness.hostSocket.executionConnectionCount() >
              connectionsBeforeDrop &&
            new URL(response.url()).pathname.startsWith('/api/jobs')
          )
            jobsSeenAfterReconnect.push(await response.text())
        })
        await expect
          .poll(() => harness.hostSocket.executionConnectionCount())
          .toBeGreaterThan(connectionsBeforeDrop)
        await expect
          .poll(() => jobsSeenAfterReconnect.join('\n'))
          .toContain(OUTPUT_FILENAME)
      })

      await test.step('the finished output is on its node without a reload', async () => {
        const nodeImage = harness.outputImage(SOURCE_NODE_ID)
        await expect(nodeImage).toBeVisible({ timeout: 10_000 })
        await expect(nodeImage).toHaveAttribute('src', OUTPUT_SRC)
      })
    })
  }
)
