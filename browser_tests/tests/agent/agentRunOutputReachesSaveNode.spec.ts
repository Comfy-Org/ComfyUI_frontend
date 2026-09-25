import { expect } from '@playwright/test'

import { agentExecutionTest as test } from '@e2e/fixtures/agentExecutionFixture'
import { QueuePanel } from '@e2e/fixtures/components/QueuePanel'
import { SOURCE_NODE_ID } from '@e2e/fixtures/data/agent/agentCrdtMultiAutogrowRealignFixture'
import enMessages from '@/locales/en/main.json' with { type: 'json' }

const OUTPUT_FILENAME = 'agent-save-node-out.png'

/**
 * User-story matrix rank 42: the run finishes but the output never appears in
 * the Save node — the result only shows in the assets panel (slack-54).
 *
 * The guard is the split itself: one finished run, and its output is present
 * on BOTH surfaces — rendered inline on the node that produced it, and as
 * that same run's row in the assets/queue panel. A regression that hides the
 * output from the node while the panel still lists it turns exactly this red.
 */
test.describe(
  'Agent run output surfaces',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test('a finished run shows its output on the producing node, not only in the assets panel', async ({
      rig: { harness, execution },
      page
    }) => {
      await page
        .getByRole('button', { name: enMessages.menu.run, exact: true })
        .click()
      await expect.poll(() => execution.submittedPrompts().length).toBe(1)
      const jobId = execution.lastSubmittedJobId()

      await execution.startJob(jobId)
      // Completed onto the source node: media type is inferred from a node's
      // inputs, and the target's video inputs would render this image as a
      // <video>.
      await execution.completeJob(jobId, {
        nodeId: String(SOURCE_NODE_ID),
        filename: OUTPUT_FILENAME
      })

      // The node that produced the output shows it inline...
      const nodeImage = harness.vueNodes
        .getNodeLocator(String(SOURCE_NODE_ID))
        .locator(`img[src*="${OUTPUT_FILENAME}"]`)
      await expect(nodeImage).toBeVisible()

      // ...and the assets panel lists the same run — the output lives on both
      // surfaces, not only in the panel.
      const queuePanel = new QueuePanel(page)
      await queuePanel.open()
      await expect(queuePanel.jobRow(jobId)).toBeVisible()
      await expect(nodeImage).toBeVisible()
    })
  }
)
