import { expect } from '@playwright/test'

import { agentExecutionTest as test } from '@e2e/fixtures/agentExecutionFixture'
import { QueuePanel } from '@e2e/fixtures/components/QueuePanel'
import { SOURCE_NODE_ID } from '@e2e/fixtures/data/agent/agentCrdtMultiAutogrowRealignFixture'
import { runSuccessFrameFor } from '@e2e/fixtures/data/agent/agentRunOutputOwner'
import enMessages from '@/locales/en/main.json' with { type: 'json' }

const JOB_ID = 'agent-exec-server-run-24332'
const OUTPUT_FILENAME = 'agent-run-output-before-owner.png'

test.describe(
  'A run whose output frame arrives before its ownership frame',
  {
    tag: ['@cloud', '@agent', '@vue-nodes'],
    annotation: {
      type: 'issue',
      description: 'https://github.com/Comfy-Org/ComfyUI_frontend/issues/24332'
    }
  },
  () => {
    test('still puts the finished output on its node', async ({
      rig: { harness, execution },
      page
    }) => {
      const queuePanel = new QueuePanel(page)

      await test.step('a run starts before this tab is told which workflow owns it', async () => {
        await execution.enqueueServerRun(JOB_ID)
        await execution.startJob(JOB_ID)
      })

      await test.step('the run finishes, so its output frame is handled unowned', async () => {
        await execution.completeJob(JOB_ID, {
          nodeId: String(SOURCE_NODE_ID),
          filename: OUTPUT_FILENAME
        })
        // Everything the canvas shows for a run is gated on ownership, so an
        // unowned job's only visible surface is its queue row. Reading that row
        // completed is therefore the one available proof that the `executed`
        // and `execution_success` frames ahead of it on the same socket have
        // already been handled — which is what makes the order under test
        // deterministic rather than a hopeful interleaving of two sockets.
        await queuePanel.open()
        await expect(queuePanel.jobRow(JOB_ID)).toContainText(
          enMessages.queue.completedIn.split('{duration}')[0]
        )
        await queuePanel.overlayToggle.click()
        await expect(queuePanel.jobAssetsList).toBeHidden()
      })

      await test.step("the agent's settled run call then names the owning workflow", async () => {
        harness.hostSocket.send(runSuccessFrameFor(JOB_ID))
      })

      await test.step('the output the user already paid for is on the node', async () => {
        const nodeImage = harness.outputImage(SOURCE_NODE_ID)
        await expect(nodeImage).toBeVisible()
        await expect(nodeImage).toHaveAttribute(
          'src',
          new RegExp(OUTPUT_FILENAME)
        )
      })
    })
  }
)
