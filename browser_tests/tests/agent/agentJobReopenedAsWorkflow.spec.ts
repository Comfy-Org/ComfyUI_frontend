import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { JobDetail } from '@/platform/remote/comfyui/jobs/jobTypes'

import { agentExecutionStoryTest as test } from '@e2e/fixtures/agentExecutionStoryFixture'
import { QueuePanel } from '@e2e/fixtures/components/QueuePanel'
import { Topbar } from '@e2e/fixtures/components/Topbar'
import {
  SOURCE_NODE_ID,
  WORKFLOW_ID
} from '@e2e/fixtures/data/agent/agentCrdtMultiAutogrowRealignFixture'

const SERVER_RUN_JOB_ID = 'agent-run-job-79'
const OUTPUT_FILENAME = 'agent-reopen-out.png'
const OPEN_AS_WORKFLOW = enMessages.queue.jobMenu.openAsWorkflowNewTab

// A two-node graph in the frontend ("save") format: a top-level `nodes` array,
// which is what `validateComfyWorkflow` needs to rebuild a canvas.
const FRONTEND_WORKFLOW = {
  id: '5f2f2c22-0000-4000-8000-0000000000aa',
  revision: 0,
  last_node_id: 2,
  last_link_id: 1,
  nodes: [
    {
      id: 1,
      type: 'CheckpointLoaderSimple',
      pos: [80, 80],
      size: [320, 100],
      flags: {},
      order: 0,
      mode: 0,
      inputs: [],
      outputs: [
        { name: 'MODEL', type: 'MODEL', links: [] },
        { name: 'CLIP', type: 'CLIP', links: [] },
        { name: 'VAE', type: 'VAE', links: [] }
      ],
      properties: {},
      widgets_values: ['v1-5-pruned-emaonly.safetensors']
    },
    {
      id: 2,
      type: 'PreviewImage',
      pos: [480, 80],
      size: [240, 260],
      flags: {},
      order: 1,
      mode: 0,
      inputs: [{ name: 'images', type: 'IMAGE', link: null }],
      outputs: [],
      properties: {},
      widgets_values: []
    }
  ],
  links: [],
  groups: [],
  config: {},
  extra: {},
  version: 0.4
}

// The prompt/API format: a flat map of node id → { class_type, inputs }, with
// no top-level `nodes`. Runnable, not editable.
const API_FORMAT_PROMPT = {
  '1': {
    class_type: 'CheckpointLoaderSimple',
    inputs: { ckpt_name: 'v1-5-pruned-emaonly.safetensors' }
  },
  '2': { class_type: 'PreviewImage', inputs: { images: ['1', 0] } }
}

function jobDetail(workflow: unknown): JobDetail {
  return {
    id: SERVER_RUN_JOB_ID,
    status: 'completed',
    create_time: Date.UTC(2026, 8, 25, 12),
    execution_start_time: Date.UTC(2026, 8, 25, 12),
    execution_end_time: Date.UTC(2026, 8, 25, 12) + 5_000,
    priority: 0,
    outputs_count: 1,
    preview_output: null,
    workflow
  }
}

/** The job row's "More" menu, opened the way a user opens it. */
async function openJobMenu(
  queuePanel: QueuePanel,
  jobId: string
): Promise<void> {
  const row = queuePanel.jobRow(jobId)
  await expect(row).toBeVisible()
  await row.hover()
  const more = row.getByRole('button', { name: 'More', exact: true })
  await expect(more).toBeVisible()
  await more.click()
}

function openAsWorkflowItem(page: Page): Locator {
  return page.getByRole('button', { name: OPEN_AS_WORKFLOW, exact: true })
}

/**
 * User-story matrix rank 79 / slack-63 — "an agent-generated job cannot be
 * reopened as a workflow". Never authored: the stated blocker was that the
 * ordinary agent fixture has no execution or output surface, which #18790 and
 * the story fixture on this stack now provide. `cover-1` re-opened it
 * (`reports/design/2026-09-26-matrix-coverage-audit.md`).
 *
 * The job under test is a SERVER-submitted run — the agent's `run` tool
 * submits cloud-side, so the browser first learns of the job from the queue,
 * never having POSTed it. That is what makes this story about agent jobs
 * rather than about the queue in general.
 *
 * `openJobWorkflow` (`useJobMenu.ts`) reads `GET /api/jobs/{id}` and pulls the
 * graph out of `workflow.extra_data.extra_pnginfo.workflow`. Cloud stores that
 * `workflow` as the verbatim `/api/prompt` body
 * (`services/ingest/server/implementation/prompt.go`, `SetWorkflowJSON`), so
 * what the action can do is decided by what the submitter sent.
 *
 * Both surfaces that offer this action — the queue overlay here and the Job
 * History sidebar tab — render the same `useJobMenu` entry and call the same
 * `openJobWorkflow`, so asserting through the overlay covers both.
 */
test.describe(
  'Reopening an agent-generated job as a workflow',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test('opens a new tab with the graph the agent ran', async ({
      rig: { harness, execution },
      page
    }) => {
      const topbar = new Topbar(page)
      const tabsBefore = await topbar.tabs.count()

      await test.step('the agent submits a run server-side and it completes', async () => {
        await execution.enqueueServerRun(SERVER_RUN_JOB_ID, {
          workflowId: WORKFLOW_ID
        })
        await execution.startJob(SERVER_RUN_JOB_ID)
        await execution.completeJob(SERVER_RUN_JOB_ID, {
          nodeId: String(SOURCE_NODE_ID),
          filename: OUTPUT_FILENAME
        })
        // The browser never posted this job; it is here because the queue
        // reported it.
        expect(execution.submittedPrompts()).toHaveLength(0)
      })

      // The submission carried the editable graph, as a browser submit does.
      await execution.mockJobDetail(
        SERVER_RUN_JOB_ID,
        jobDetail({
          extra_data: { extra_pnginfo: { workflow: FRONTEND_WORKFLOW } }
        })
      )

      const queuePanel = new QueuePanel(page)
      await queuePanel.open()
      await openJobMenu(queuePanel, SERVER_RUN_JOB_ID)
      await openAsWorkflowItem(page).click()

      await test.step('a new tab holds the job’s graph', async () => {
        await expect(topbar.tabs).toHaveCount(tabsBefore + 1)
        await expect(
          topbar.getActiveTab().filter({ hasText: `Job ${SERVER_RUN_JOB_ID}` })
        ).toBeVisible()
        for (const node of FRONTEND_WORKFLOW.nodes)
          await expect(
            harness.vueNodes.getNodeLocator(String(node.id))
          ).toBeVisible()
      })
    })

    // LIVE-DEFECT PIN — expected to fail on `main`.
    //
    // An agent that built the graph itself can leave the working draft in API
    // format, and cloud says so in its own words: the run "runs but isn't yet
    // editable on the canvas", there is no API→frontend converter in comfy-cli,
    // and `draftNeedsFrontendConversion` exists precisely to make the condition
    // observable rather than silent (`services/agent/internal/loop/tools.go`,
    // `apiFormat := tc.draftNeedsFrontendConversion()`). A job submitted from
    // such a draft is stored with no `extra_pnginfo.workflow`.
    //
    // `openJobWorkflow` then does this:
    //
    //     const data = await getJobWorkflow(target.id)
    //     if (!data) return
    //
    // — the menu closes and NOTHING else happens. No tab, no toast, no dialog.
    // The user is left believing the click did not register. (The message the
    // report quotes, "no workflow data is available", is
    // `mediaAsset.noWorkflowDataFound`, which belongs to the asset route; the
    // job-menu route says nothing at all.)
    //
    // This pin does not require the tab to open — rebuilding a canvas from an
    // API prompt is real work and may well belong server-side. It requires the
    // user to be told. It is satisfied by any visible refusal.
    test.fail(
      'says why it cannot, when the agent ran a graph it cannot rebuild',
      async ({ rig: { execution }, page }) => {
        const topbar = new Topbar(page)
        const tabsBefore = await topbar.tabs.count()

        await execution.enqueueServerRun(SERVER_RUN_JOB_ID, {
          workflowId: WORKFLOW_ID
        })
        await execution.startJob(SERVER_RUN_JOB_ID)
        await execution.completeJob(SERVER_RUN_JOB_ID, {
          nodeId: String(SOURCE_NODE_ID),
          filename: OUTPUT_FILENAME
        })

        // Runnable, not editable: a prompt with no frontend graph beside it.
        await execution.mockJobDetail(
          SERVER_RUN_JOB_ID,
          jobDetail({ extra_data: {}, prompt: API_FORMAT_PROMPT })
        )

        const queuePanel = new QueuePanel(page)
        await queuePanel.open()
        await openJobMenu(queuePanel, SERVER_RUN_JOB_ID)
        await openAsWorkflowItem(page).click()

        // Nothing opened — that part is not the defect on its own.
        await expect(topbar.tabs).toHaveCount(tabsBefore)

        // The defect is that nothing was said either. A toast is how the app
        // refuses the SAME action on the asset route
        // (`useMediaAssetActions.ts`, `mediaAsset.noWorkflowDataFound`), so it
        // is the mechanism this route is missing rather than an invented one.
        //
        // Deliberately not asserted here, though it is also true and also
        // wrong: the menu does not even close, so the click leaves the UI
        // exactly as it was. Keeping this pin to one claim keeps it honest
        // about which fix satisfies it.
        await expect(page.locator('.p-toast-message:visible')).toBeVisible()
      }
    )
  }
)
