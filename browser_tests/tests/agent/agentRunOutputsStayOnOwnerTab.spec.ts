import { expect } from '@playwright/test'

import { agentExecutionTest as test } from '@e2e/fixtures/agentExecutionFixture'
import { SOURCE_NODE_ID } from '@e2e/fixtures/data/agent/agentCrdtMultiAutogrowRealignFixture'
import {
  HIDDEN_OUTPUT,
  RUN_JOB_ID,
  SHOWN_OUTPUT,
  runSuccessFrame
} from '@e2e/fixtures/data/agent/agentRunOutputOwner'

test.describe(
  'PM-2275: an Agent run keeps its outputs on the tab it ran for',
  {
    tag: ['@cloud', '@agent', '@vue-nodes'],
    annotation: {
      type: 'issue',
      description: 'https://linear.app/comfyorg/issue/PM-2275'
    }
  },
  () => {
    test('an output that lands while the user is on another tab is there on return', async ({
      rig: { harness, execution }
    }) => {
      const { topbar } = harness

      await test.step('the agent submits a run for this workflow', async () => {
        harness.hostSocket.send(runSuccessFrame)
        await execution.enqueueServerRun(RUN_JOB_ID)
        await execution.startJob(RUN_JOB_ID)
      })

      await test.step('the first output lands while its tab is visible', async () => {
        execution.deliverOutput(RUN_JOB_ID, {
          nodeId: String(SOURCE_NODE_ID),
          filename: SHOWN_OUTPUT
        })
        await expect(harness.outputImage(SOURCE_NODE_ID)).toHaveAttribute(
          'src',
          new RegExp(SHOWN_OUTPUT)
        )
      })

      await test.step('the user opens a copy of the workflow mid-run, with the same node ids', async () => {
        await harness.duplicateWorkflowIntoNewTab()
        await expect(
          harness.vueNodes.getNodeLocator(String(SOURCE_NODE_ID))
        ).toBeVisible()
      })

      await test.step('the second output lands while its tab is hidden', async () => {
        execution.deliverOutput(RUN_JOB_ID, {
          nodeId: String(SOURCE_NODE_ID),
          filename: HIDDEN_OUTPUT
        })
        execution.status(1)
      })

      await test.step('the run tab shows the output that landed while hidden', async () => {
        await topbar.getTab(0).click()
        await expect(topbar.getTab(0).and(topbar.getActiveTab())).toBeVisible()
        await expect(harness.outputImage(SOURCE_NODE_ID)).toHaveAttribute(
          'src',
          new RegExp(HIDDEN_OUTPUT)
        )
      })

      await test.step("the copy does not show the run's output", async () => {
        await topbar.getTab(1).click()
        await expect(topbar.getTab(1).and(topbar.getActiveTab())).toBeVisible()
        await expect(harness.outputImage(SOURCE_NODE_ID)).toHaveCount(0)
      })
    })
  }
)
