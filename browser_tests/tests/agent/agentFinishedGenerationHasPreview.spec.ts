import { expect } from '@playwright/test'

import { agentExecutionTest as test } from '@e2e/fixtures/agentExecutionFixture'
import { QueuePanel } from '@e2e/fixtures/components/QueuePanel'
import { SOURCE_NODE_ID } from '@e2e/fixtures/data/agent/agentCrdtMultiAutogrowRealignFixture'

const JOB_ID = 'agent-finished-generation-1'
const OUTPUT_FILENAME = 'agent-finished-generation-out.png'

/**
 * User-story matrix rank 98, the fixture-supported half: a finished
 * generation carries a visible inline preview.
 *
 * The story (notion-37, linear-19) is that a generation finishes and the user
 * is given nothing to look at — a bare URL, a hidden output, or a reply that
 * never says where the result is. The half a deterministic fixture can own:
 * an agent-submitted run that completes must yield a preview the user can
 * actually see, served from the completed output itself, on the queue
 * surface's history row.
 *
 * NOT covered here, deliberately: the agent-panel half — the assistant reply
 * presenting a result link / inline preview for the finished generation. That
 * assertion needs the agent's own reply frames with real content: authoring
 * those frames in a fixture would only prove that our invented markdown
 * renders, not that the product's reply carries a result link. It needs
 * either a recorded real conversation (the recording-stack workstream) or a
 * product-side contract for result links in replies; whichever lands first
 * unblocks the other half of this story.
 */
test.describe(
  'Agent finished generation preview',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test('a completed server-side generation shows a preview thumbnail rendered from its output', async ({
      rig: { execution },
      page
    }) => {
      // The agent's run tool submitted server-side; the browser first meets
      // the job on the queue surface.
      await execution.enqueueServerRun(JOB_ID)
      await execution.startJob(JOB_ID)
      await execution.completeJob(JOB_ID, {
        nodeId: String(SOURCE_NODE_ID),
        filename: OUTPUT_FILENAME
      })

      // The finished generation is discoverable with a real preview: its
      // history row renders a thumbnail served from the completed output.
      const queuePanel = new QueuePanel(page)
      await queuePanel.open()
      const jobRow = queuePanel.jobRow(JOB_ID)
      await expect(jobRow).toBeVisible()
      await expect(
        jobRow.locator(`img[src*="${OUTPUT_FILENAME}"]`)
      ).toBeVisible()
    })
  }
)
