import { expect } from '@playwright/test'

import type { AgentAnswerAccepted } from '@comfyorg/ingest-types'
import { zAgentAnswerRequest } from '@comfyorg/ingest-types/zod'

import {
  agentExecutionStoryTest as test,
  runToolCallFrame,
  settleStoryTurn,
  startStoryTurn
} from '@e2e/tests/agent/agentExecutionStoryFixture'
import { QueuePanel } from '@e2e/fixtures/components/QueuePanel'
import { nextFrame } from '@e2e/fixtures/utils/timing'
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
const ANSWER_PATH = `/api/agent/threads/${THREAD_ID}/asks/${encodeURIComponent(ASK_ID)}/answer`

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
      const answers: { method: string; path: string; selected: string[] }[] = []
      await page.route('**/api/agent/threads/*/asks/*/answer', (route) => {
        const body = zAgentAnswerRequest.parse(route.request().postDataJSON())
        answers.push({
          method: route.request().method(),
          path: new URL(route.request().url()).pathname,
          selected: body.selected
        })
        const accepted: AgentAnswerAccepted = {
          status: 'answered',
          selected: body.selected
        }
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
        harness.panel.getByText(enMessages.agent.runApproval.leadBound)
      ).toBeVisible()
      await harness.panel
        .getByRole('button', {
          name: enMessages.agent.runApproval.run,
          exact: true
        })
        .click()
      await expect.poll(() => answers.length).toBe(1)
      expect(answers[0]).toEqual({
        method: 'POST',
        path: ANSWER_PATH,
        selected: ['run']
      })

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
      await nextFrame(page)
      const nodeImage = harness.vueNodes
        .getNodeLocator(String(SOURCE_NODE_ID))
        .getByRole('img', { name: 'View image 1 of 1' })
      await expect(nodeImage).toHaveAttribute(
        'src',
        new RegExp(OUTPUT_FILENAME)
      )
      await expect(nodeImage).toBeVisible()
      await queuePanel.overlay
        .getByRole('button', { name: 'Completed', exact: true })
        .click()
      const historyRow = queuePanel.jobRow(JOB_ID)
      await expect(historyRow).toBeVisible()
      const historyImage = historyRow.getByRole('img')
      await expect(historyImage).toHaveAttribute(
        'src',
        /[?&]filename=agent-golden-path-out\.png/
      )
      await expect
        .poll(() =>
          historyImage.evaluate(
            (image: HTMLImageElement) =>
              image.complete && image.naturalWidth > 0
          )
        )
        .toBe(true)
    })
  }
)
