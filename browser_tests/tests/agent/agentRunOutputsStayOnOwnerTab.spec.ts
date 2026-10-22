import { expect } from '@playwright/test'

import type { AgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import { agentExecutionTest as test } from '@e2e/fixtures/agentExecutionFixture'
import {
  MESSAGE_ID,
  SOURCE_NODE_ID,
  THREAD_ID,
  WORKFLOW_ID
} from '@e2e/fixtures/data/agent/agentCrdtMultiAutogrowRealignFixture'

const JOB_ID = 'agent-exec-server-run-pm-2275'
const SHOWN_OUTPUT = 'agent-run-shown-output.png'
const HIDDEN_OUTPUT = 'agent-run-hidden-output.png'

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
      rig: { harness, execution },
      page
    }) => {
      const { topbar } = harness

      await test.step('the agent submits a run for this workflow', async () => {
        const run: AgentWsEvent = {
          type: 'agent_tool_call',
          data: {
            thread_id: THREAD_ID,
            message_id: MESSAGE_ID,
            tool_call_id: 'call-run-pm-2275',
            tool_name: 'run',
            status: 'success',
            duration_ms: 40,
            job_id: JOB_ID,
            job_workflow_id: WORKFLOW_ID
          }
        }
        harness.hostSocket.send(run)
        await execution.enqueueServerRun(JOB_ID)
        await execution.startJob(JOB_ID)
      })

      await test.step('the first output lands while its tab is visible', async () => {
        execution.deliverOutput(JOB_ID, {
          nodeId: String(SOURCE_NODE_ID),
          filename: SHOWN_OUTPUT
        })
        await expect(harness.outputImage(SOURCE_NODE_ID)).toHaveAttribute(
          'src',
          new RegExp(SHOWN_OUTPUT)
        )
      })

      await test.step('the user opens another workflow mid-run', async () => {
        await topbar.newWorkflowButton.click()
        await expect(topbar.tabs).toHaveCount(2)
        await expect(topbar.getTab(1).and(topbar.getActiveTab())).toBeVisible()
      })

      await test.step('the second output lands while its tab is hidden, before the queue refresh it precedes', async () => {
        const handled = page.waitForRequest(/\/api\/jobs\?/)
        execution.deliverOutput(JOB_ID, {
          nodeId: String(SOURCE_NODE_ID),
          filename: HIDDEN_OUTPUT
        })
        execution.status(1)
        await handled
      })

      await test.step('the run tab shows the output that landed while hidden', async () => {
        await topbar.getTab(0).click()
        await expect(topbar.getTab(0).and(topbar.getActiveTab())).toBeVisible()
        await expect(harness.outputImage(SOURCE_NODE_ID)).toHaveAttribute(
          'src',
          new RegExp(HIDDEN_OUTPUT)
        )
      })

      await test.step('the run finishes and the output stays', async () => {
        await execution.completeJob(JOB_ID, {
          nodeId: String(SOURCE_NODE_ID),
          filename: HIDDEN_OUTPUT
        })
        await expect(harness.outputImage(SOURCE_NODE_ID)).toHaveAttribute(
          'src',
          new RegExp(HIDDEN_OUTPUT)
        )
      })
    })
  }
)
