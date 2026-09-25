import { expect } from '@playwright/test'
import type { Locator } from '@playwright/test'

import { agentExecutionTest as test } from '@e2e/fixtures/agentExecutionFixture'
import { QueuePanel } from '@e2e/fixtures/components/QueuePanel'
import {
  SOURCE_NODE_ID,
  TARGET_ID
} from '@e2e/fixtures/data/agent/agentCrdtMultiAutogrowRealignFixture'
import type { MultiAutogrowRealignHarness } from '@e2e/fixtures/helpers/MultiAutogrowRealignHarness'
import { TestIds } from '@e2e/fixtures/selectors'
import enMessages from '@/locales/en/main.json' with { type: 'json' }

/**
 * An executed run's output image on a node, served from the fixture's
 * `/api/view`. One locator for the positive and negative cases alike: the
 * completed case proves it matches when an output arrives, which is what makes
 * `toHaveCount(0)` in the failed and stalled cases mean something.
 *
 * Outputs are asserted on the *source* node throughout. A node's media type is
 * inferred from its inputs, so the autogrow target's video inputs would render
 * this image as a `<video>` — an `img` locator on the target reads zero whether
 * or not a run produced anything.
 */
function outputImage(
  harness: MultiAutogrowRealignHarness,
  nodeId: number | string
): Locator {
  return harness.vueNodes
    .getNodeLocator(String(nodeId))
    .locator('img[src*="/api/view"]')
}

/**
 * Capability proof for the agent harness's execution surface
 * (`AgentExecutionHelper`): the agent fixtures previously mocked
 * `/api/agent/*` and the doc socket but carried no queue or execution, so no
 * spec could assert anything that depends on a workflow actually running —
 * a completed run with visible outputs, a failed job, a stalled job.
 *
 * These cases prove the fixture produces each lifecycle deterministically.
 * They are harness verification, not user-story specs — the golden-path
 * story ("run it" submits the workflow and shows me the output) and its
 * failed/stalled siblings assert product behavior on top of this surface
 * and live in their own specs.
 */
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

      // "Shows me the output": the executed frame's image renders on the
      // node, served from the fixture's /api/view.
      const nodeImage = outputImage(harness, SOURCE_NODE_ID)
      await expect(nodeImage).toBeVisible()
      await expect(nodeImage).toHaveAttribute('src', /agent-exec-out\.png/)

      // And the completed job is a real history row on the queue surface.
      const queuePanel = new QueuePanel(page)
      await queuePanel.open()
      await expect(queuePanel.jobRow(jobId)).toBeVisible()
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
      await execution.failJob(jobId, {
        nodeId: TARGET_ID,
        message: 'deterministic fixture failure'
      })

      await expect(page.getByTestId(TestIds.dialogs.errorDialog)).toBeVisible()
      // The failure produced no output: asserted with the same locator, on
      // the same node, that the completed case proves matches a real output.
      // An output reaching the node would fail here rather than pass unseen.
      await expect(outputImage(harness, SOURCE_NODE_ID)).toHaveCount(0)
    })

    test('a stalled server-side run stays visibly running with no terminal state', async ({
      rig: { harness, execution },
      page
    }) => {
      // The agent's own `run` tool submits server-side: the browser never
      // POSTs /api/prompt and first meets the job on the queue surface.
      const jobId = 'agent-exec-server-run-1'
      await execution.enqueueServerRun(jobId)
      await execution.stallJob(jobId, { nodeId: TARGET_ID })

      // Visibly running: the node carries its executing outline...
      await expect(
        harness.targetNode.getByTestId('node-state-outline-overlay')
      ).toBeVisible()
      // ...and no terminal state ever arrives: no output, no error dialog.
      // Same locator and node as the completed case, so a run that quietly
      // finished and put its output on the canvas would turn this red.
      await expect(outputImage(harness, SOURCE_NODE_ID)).toHaveCount(0)
      await expect(page.getByTestId(TestIds.dialogs.errorDialog)).toHaveCount(0)
    })
  }
)
