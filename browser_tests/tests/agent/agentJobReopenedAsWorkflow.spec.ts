import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { JobDetail } from '@/platform/remote/comfyui/jobs/jobTypes'

import { agentExecutionStoryTest as test } from '@e2e/tests/agent/agentExecutionStoryFixture'
import { QueuePanel } from '@e2e/fixtures/components/QueuePanel'
import { Topbar } from '@e2e/fixtures/components/Topbar'
import { SOURCE_NODE_ID } from '@e2e/fixtures/data/agent/agentCrdtMultiAutogrowRealignFixture'

const SERVER_RUN_JOB_ID = 'agent-run-job-79'
const OUTPUT_FILENAME = 'agent-reopen-out.png'
const OPEN_AS_WORKFLOW = enMessages.queue.jobMenu.openAsWorkflowNewTab

// A two-node graph in the frontend ("save") format: a top-level `nodes` array,
// which is what `validateComfyWorkflow` needs to rebuild a canvas.
//
// Node ids 1 and 2 are deliberately the SAME ids the harness seed uses
// (`SOURCE_NODE_ID` / `TARGET_NODE_ID`), because that is what a real job graph
// is free to do — ids are per-graph. So the ids cannot witness which graph is
// on the canvas, and every node here carries an explicit `title` instead. A
// title wins over the node definition's `display_name`
// (`resolveNodeDisplayName`, `src/utils/nodeTitleUtil.ts`), so these strings
// are what the header renders regardless of what `object_info` serves, and no
// seed node can produce them.
const JOB_CHECKPOINT_TITLE = 'Job graph checkpoint loader'
const JOB_PREVIEW_TITLE = 'Job graph preview image'

const FRONTEND_WORKFLOW = {
  id: '5f2f2c22-0000-4000-8000-0000000000aa',
  revision: 0,
  last_node_id: 2,
  last_link_id: 1,
  nodes: [
    {
      id: 1,
      type: 'CheckpointLoaderSimple',
      title: JOB_CHECKPOINT_TITLE,
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
      title: JOB_PREVIEW_TITLE,
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

/**
 * The job row's "More" menu, opened the way a user opens it. Mirrors
 * `QueuePanel.addOutputToCurrentWorkflow`, which is the house idiom for this
 * menu, rather than re-deriving the interaction.
 */
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

/**
 * `menuitem`, not `button`: the entries come from `useJobMenu`'s
 * `jobMenuEntries` as PrimeVue `MenuItem`s, so they carry the `menuitem` role
 * — which is also how `QueuePanel.addOutputToCurrentWorkflow` locates its
 * sibling entry. Querying `button` here matched nothing and timed the test
 * out instead of failing on the behaviour.
 */
function openAsWorkflowItem(page: Page): Locator {
  return page.getByRole('menuitem', { name: OPEN_AS_WORKFLOW, exact: true })
}

/**
 * Asserts the entry before clicking it, so a renamed label or changed role
 * fails on the locator at the expect timeout instead of silently consuming
 * the whole 180s test budget inside `click`'s auto-wait.
 *
 * The menu entry's `command` is fire-and-forget (`useJobMenu.ts`,
 * `command: () => openJobWorkflow()`), so `click` resolves as soon as the DOM
 * event is dispatched — long before `openJobWorkflow` has awaited
 * `GET /api/jobs/{id}`, which is the fetch that decides whether a tab opens at
 * all. Anything asserted straight after a bare `click` is therefore racing the
 * action. This waits for that response before returning, so a caller's next
 * assertion is made against an action that has passed its only async boundary
 * ahead of the tab.
 */
async function clickOpenAsWorkflow(page: Page, jobId: string): Promise<void> {
  const item = openAsWorkflowItem(page)
  await expect(item).toBeVisible()

  const jobDetailFetched = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/jobs/${encodeURIComponent(jobId)}`) &&
      response.request().method().toUpperCase() === 'GET'
  )
  await item.click()
  await jobDetailFetched
}

/**
 * How long a tab gets to appear before "no tab opened" is believed. The
 * success case opens its tab after the same `GET /api/jobs/{id}` this waits
 * past, so this only has to cover `createTemporary` plus `openWorkflow`'s
 * render — but a negative assertion is only as good as the window it is given,
 * so this is deliberately far longer than that.
 */
const NO_NEW_TAB_WINDOW_MS = 5_000

/**
 * Requires that no tab is added, by actually waiting for one.
 *
 * `expect(tabs).toHaveCount(before)` cannot express this: it is satisfied by
 * its first sample, so it reports success for "the tab has not been created
 * YET" — which is the state the click leaves the page in. Waiting for the tab
 * that would be created and requiring that wait to time out is the same claim
 * stated so that it can fail.
 */
async function expectNoTabOpened(
  topbar: Topbar,
  tabsBefore: number
): Promise<void> {
  await expect(
    topbar.tabs
      .nth(tabsBefore)
      .waitFor({ state: 'attached', timeout: NO_NEW_TAB_WINDOW_MS })
  ).rejects.toThrow(/Timeout/)
  await expect(topbar.tabs).toHaveCount(tabsBefore)
}

/**
 * User-story matrix rank 79 / slack-63 — "an agent-generated job cannot be
 * reopened as a workflow". Never authored: the stated blocker was that the
 * ordinary agent fixture has no execution or output surface, which #18790 and
 * this stack's story fixture now provide.
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
        await execution.enqueueServerRun(SERVER_RUN_JOB_ID)
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
      await clickOpenAsWorkflow(page, SERVER_RUN_JOB_ID)

      await test.step('a new tab holds the job’s graph', async () => {
        await expect(topbar.tabs).toHaveCount(tabsBefore + 1)
        await expect(
          topbar.getActiveTab().filter({ hasText: `Job ${SERVER_RUN_JOB_ID}` })
        ).toBeVisible()
        // By title bound to id, not by id alone: `getNodeLocator` is a
        // page-wide `[data-node-id]` query and the seed occupies these very
        // ids, so an id-only assertion is satisfied by the graph this step
        // claims was replaced. The title is what only the job graph can
        // supply.
        for (const node of FRONTEND_WORKFLOW.nodes)
          await expect(
            harness.vueNodes
              .getNodeByTitle(node.title)
              .and(harness.vueNodes.getNodeLocator(String(node.id)))
          ).toBeVisible()
      })
    })

    // LIVE-DEFECT PIN — the final assertion is expected to fail on `main`.
    //
    // An agent that built the graph itself can leave the working draft in API
    // format, and cloud says so in its own words: the run "runs but isn't yet
    // editable on the canvas", there is no API→frontend converter in comfy-cli,
    // and `draftNeedsFrontendConversion` exists precisely to make the condition
    // observable rather than silent (`services/agent/internal/loop/tools.go`,
    // `apiFormat := tc.draftNeedsFrontendConversion()`). A job submitted from
    // such a draft is stored with no `extra_pnginfo.workflow`.
    //
    // `openJobWorkflow` then does this (`useJobMenu.ts:55-56` on `main`):
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
    //
    // `test.fail` is declared immediately before that one assertion rather
    // than over the whole test, so every step above it must genuinely pass: a
    // job that never reaches the queue, a "More" menu that never opens, a
    // missing menu entry or a tab that unexpectedly DOES open all fail the
    // test rather than being absorbed as the expected defect.
    test('says why it cannot, when the agent ran a graph it cannot rebuild', async ({
      rig: { execution },
      page,
      toast
    }) => {
      const topbar = new Topbar(page)
      const tabsBefore = await topbar.tabs.count()

      await execution.enqueueServerRun(SERVER_RUN_JOB_ID)
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

      // Baseline for the pinned assertion below, and outside the
      // expected-failure window: if setup had left a toast on screen, "a toast
      // is visible" would be satisfied by that toast rather than by a refusal,
      // and the pin would pass for a reason unrelated to the defect.
      await expect(toast.visibleToasts).toHaveCount(0)

      await clickOpenAsWorkflow(page, SERVER_RUN_JOB_ID)

      // Nothing opened — that part is not the defect on its own, and it is
      // asserted outside the expected-failure window so a tab that DOES open
      // is reported as a test failure rather than read as the known defect.
      await expectNoTabOpened(topbar, tabsBefore)

      // The defect is that nothing was said either. A toast is how the app
      // refuses the SAME action on the asset route
      // (`useMediaAssetActions.ts`, `mediaAsset.noWorkflowDataFound`), so it
      // is the mechanism this route is missing rather than an invented one.
      //
      // Asserted through the `toast` fixture, which tracks what actually
      // renders a toast on this branch (`[data-testid="toast"]`,
      // `src/components/ui/toast/Toaster.vue`). The PrimeVue `.p-toast-message`
      // class is gone from the app, so a locator built on it would match
      // nothing even after a refusal lands — the pin would stay red forever
      // and could never confirm the fix.
      //
      // Deliberately not asserted, though it is also true and also wrong: the
      // menu does not even close, so the click leaves the UI exactly as it
      // was. Keeping this pin to one claim keeps it honest about which fix
      // satisfies it.
      test.fail(
        true,
        'useJobMenu.openJobWorkflow returns silently when the job carries no frontend graph — no toast, no dialog, no tab'
      )
      await expect(toast.visibleToasts.first()).toBeVisible()
    })
  }
)
