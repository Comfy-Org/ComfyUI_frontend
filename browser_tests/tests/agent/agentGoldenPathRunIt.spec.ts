import { expect } from '@playwright/test'

import type { AgentAnswerAccepted } from '@comfyorg/ingest-types'

import {
  agentExecutionStoryTest as test,
  runToolCallFrame,
  settleStoryTurn,
  startStoryTurn
} from '@e2e/fixtures/agentExecutionStoryFixture'
import { QueuePanel } from '@e2e/fixtures/components/QueuePanel'
import {
  MESSAGE_ID,
  SOURCE_NODE_ID,
  THREAD_ID,
  WORKFLOW_ID
} from '@e2e/fixtures/data/agent/agentCrdtMultiAutogrowRealignFixture'
import enMessages from '@/locales/en/main.json' with { type: 'json' }

const JOB_ID = 'agent-golden-path-run-1'
const OUTPUT_FILENAME = 'agent-golden-path-out.png'
const ASK_ID = `${MESSAGE_ID}:call-run`

const ids = { message_id: MESSAGE_ID, thread_id: THREAD_ID }

/**
 * GOLDEN PATH (user-story matrix rank 26): "run it" submits the workflow and
 * shows me the output.
 *
 * The journey, end to end as the user sees it: ask the agent to run the
 * workflow, approve the run when the agent asks, watch the run land on the
 * queue, and see the finished output on the canvas node and in job history.
 * The run is submitted by the agent's `run` tool on the server — approval is
 * answered over REST and the browser never POSTs `/api/prompt` — which is why
 * the job enters through `enqueueServerRun` rather than a client submission.
 *
 * Harness verification for every lever used here is
 * `agentExecutionLifecycle.spec.ts`; this spec asserts the product journey on
 * top of that surface, not the fixture itself.
 */
test.describe(
  'Agent golden path',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test('"run it" submits the workflow and shows me the output', async ({
      rig: { harness, execution },
      page
    }) => {
      // Run approval is answered over REST; the parked turn then resumes on
      // the socket (`agent_ask_resolved` is the canonical resolution).
      const answers: string[][] = []
      await page.route('**/api/agent/threads/*/asks/*/answer', (route) => {
        const body = route.request().postDataJSON() as { selected: string[] }
        answers.push(body.selected)
        const accepted: AgentAnswerAccepted = { status: 'answered' }
        return route.fulfill({
          status: 202,
          contentType: 'application/json',
          body: JSON.stringify(accepted)
        })
      })

      // The user asks the agent to run the workflow.
      await startStoryTurn(harness, 'run it')

      // The agent asks for approval to run, and the user approves.
      harness.hostSocket.send({
        type: 'agent_ask',
        data: {
          ...ids,
          ask_id: ASK_ID,
          kind: 'run_approval',
          context: {
            workflow_id: WORKFLOW_ID,
            workflow_name: 'Unsaved Workflow'
          },
          prompt: 'Run workflow “Unsaved Workflow”?',
          options: [
            { id: 'run', label: 'Run' },
            { id: 'cancel', label: 'Cancel' }
          ],
          min_selections: 1,
          max_selections: 1,
          allow_other: false
        }
      })
      await expect(
        harness.panel.getByText(enMessages.agent.runApproval.lead)
      ).toBeVisible()
      await harness.panel
        .getByRole('button', {
          name: enMessages.agent.runApproval.run,
          exact: true
        })
        .click()
      await expect.poll(() => answers.length).toBe(1)
      expect(answers[0]).toEqual(['run'])

      // The turn resumes: the run tool submits the workflow server-side and
      // the job starts, then the agent's turn completes.
      harness.hostSocket.send({
        type: 'agent_ask_resolved',
        data: { ...ids, ask_id: ASK_ID, status: 'answered', selected: ['run'] }
      })
      harness.hostSocket.send(runToolCallFrame('running'))
      await execution.enqueueServerRun(JOB_ID)
      await execution.startJob(JOB_ID)
      harness.hostSocket.send(runToolCallFrame('success'))
      await settleStoryTurn(harness)

      // "Submits the workflow": the run is a real job the user can see on the
      // queue surface. It was submitted by the agent on the server — the
      // browser itself never POSTed /api/prompt.
      const queuePanel = new QueuePanel(page)
      await queuePanel.open()
      await expect(queuePanel.jobRow(JOB_ID)).toBeVisible()
      expect(execution.submittedPrompts()).toHaveLength(0)

      // "Shows me the output": the finished run's image renders on the node
      // (completed onto the source node — media type is inferred from a
      // node's inputs, and the target's video inputs would render an image
      // output as a <video>), and the job survives as a history row.
      await execution.completeJob(JOB_ID, {
        nodeId: String(SOURCE_NODE_ID),
        filename: OUTPUT_FILENAME
      })
      const nodeImage = harness.vueNodes
        .getNodeLocator(String(SOURCE_NODE_ID))
        .locator(`img[src*="${OUTPUT_FILENAME}"]`)
      await expect(nodeImage).toBeVisible()
      await expect(queuePanel.jobRow(JOB_ID)).toBeVisible()
    })
  }
)
