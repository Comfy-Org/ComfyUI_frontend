import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { JobDetail } from '@comfyorg/api-client/jobTypes'

import { agentExecutionStoryTest as test } from '@e2e/tests/agent/agentExecutionStoryFixture'
import { QueuePanel } from '@e2e/fixtures/components/QueuePanel'
import { Topbar } from '@e2e/fixtures/components/Topbar'
import { SOURCE_NODE_ID } from '@e2e/fixtures/data/agent/agentCrdtMultiAutogrowRealignFixture'

const SERVER_RUN_JOB_ID = 'agent-run-job-79'
const OUTPUT_FILENAME = 'agent-reopen-out.png'
const OPEN_AS_WORKFLOW = enMessages.queue.jobMenu.openAsWorkflowNewTab

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
  return page.getByRole('menuitem', { name: OPEN_AS_WORKFLOW, exact: true })
}

async function clickOpenAsWorkflowAndAwaitJobDetail(
  page: Page,
  jobId: string
): Promise<void> {
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

const NO_NEW_TAB_WINDOW_MS = 5_000

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
        expect(execution.submittedPrompts()).toHaveLength(0)
      })

      await execution.mockJobDetail(
        SERVER_RUN_JOB_ID,
        jobDetail({
          extra_data: { extra_pnginfo: { workflow: FRONTEND_WORKFLOW } }
        })
      )

      const queuePanel = new QueuePanel(page)
      await queuePanel.open()
      await openJobMenu(queuePanel, SERVER_RUN_JOB_ID)
      await clickOpenAsWorkflowAndAwaitJobDetail(page, SERVER_RUN_JOB_ID)

      await test.step('a new tab holds the job’s graph', async () => {
        await expect(topbar.tabs).toHaveCount(tabsBefore + 1)
        await expect(
          topbar.getActiveTab().filter({ hasText: `Job ${SERVER_RUN_JOB_ID}` })
        ).toBeVisible()
        for (const node of FRONTEND_WORKFLOW.nodes)
          await expect(
            harness.vueNodes
              .getNodeByTitle(node.title)
              .and(harness.vueNodes.getNodeLocator(String(node.id)))
          ).toBeVisible()
      })
    })

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

      await execution.mockJobDetail(
        SERVER_RUN_JOB_ID,
        jobDetail({ extra_data: {}, prompt: API_FORMAT_PROMPT })
      )

      const queuePanel = new QueuePanel(page)
      await queuePanel.open()
      await openJobMenu(queuePanel, SERVER_RUN_JOB_ID)

      await expect(toast.visibleToasts).toHaveCount(0)

      await clickOpenAsWorkflowAndAwaitJobDetail(page, SERVER_RUN_JOB_ID)

      await expectNoTabOpened(topbar, tabsBefore)

      await expect(toast.visibleToasts.first()).toBeVisible()
    })
  }
)
