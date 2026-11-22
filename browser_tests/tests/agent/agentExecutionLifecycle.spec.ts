import { expect } from '@playwright/test'

import { agentExecutionTest as test } from '@e2e/fixtures/agentExecutionFixture'
import { QueuePanel } from '@e2e/fixtures/components/QueuePanel'
import {
  SOURCE_NODE_ID,
  TARGET_ID
} from '@e2e/fixtures/data/agent/agentCrdtMultiAutogrowRealignFixture'
import { TestIds } from '@e2e/fixtures/selectors'
import enMessages from '@/locales/en/main.json' with { type: 'json' }

test.describe(
  'Agent harness execution lifecycle',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test('a submitted run completes with its output on the node and a history row', async ({
      rig: { harness, execution },
      page
    }) => {
      await page
        .getByRole('button', { name: enMessages.menu.run, exact: true })
        .click()
      await expect.poll(() => execution.submittedPrompts().length).toBe(1)
      const jobId = execution.lastSubmittedJobId()

      await execution.startJob(jobId)
      await execution.completeJob(jobId, {
        nodeId: String(SOURCE_NODE_ID),
        filename: 'agent-exec-out.png'
      })

      const nodeImage = harness.outputImage(SOURCE_NODE_ID)
      await expect(nodeImage).toBeVisible()
      await expect(nodeImage).toHaveAttribute('src', /agent-exec-out\.png/)

      const queuePanel = new QueuePanel(page)
      await queuePanel.open()
      await expect(queuePanel.jobRow(jobId)).toContainText(
        enMessages.queue.completedIn.split('{duration}')[0]
      )
    })

    test('a failed run surfaces its error instead of reading as success', async ({
      rig: { harness, execution },
      page
    }) => {
      await page
        .getByRole('button', { name: enMessages.menu.run, exact: true })
        .click()
      await expect.poll(() => execution.submittedPrompts().length).toBe(1)
      const jobId = execution.lastSubmittedJobId()

      await execution.startJob(jobId)
      const failureMessage = 'deterministic fixture failure'
      await execution.failJob(jobId, {
        nodeId: TARGET_ID,
        message: failureMessage
      })

      await expect(page.getByTestId(TestIds.dialogs.errorDialog)).toContainText(
        failureMessage
      )
      // The failure produced no output: asserted with the same locator, on
      // the same node, that the completed case proves matches a real output.
      // An output reaching the node would fail here rather than pass unseen.
      await expect(harness.outputImage(SOURCE_NODE_ID)).toHaveCount(0)
    })

    test('a stalled server-side run stays visibly running with no terminal state', async ({
      rig: { harness, execution },
      page
    }) => {
      const jobId = 'agent-exec-server-run-1'
      await execution.enqueueServerRun(jobId)
      await execution.stallJob(jobId, { nodeId: TARGET_ID })

      await expect(
        harness.targetNode.getByTestId('node-state-outline-overlay')
      ).toBeVisible()
      // ...and no terminal state ever arrives: no output, no error dialog.
      // Same locator and node as the completed case, so a run that quietly
      // finished and put its output on the canvas would turn this red.
      await expect(harness.outputImage(SOURCE_NODE_ID)).toHaveCount(0)
      await expect(page.getByTestId(TestIds.dialogs.errorDialog)).toHaveCount(0)
    })
  }
)
