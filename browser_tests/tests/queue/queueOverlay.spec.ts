import { expect, mergeTests } from '@playwright/test'
import type { ListAssetsResponse } from '@comfyorg/ingest-types'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import {
  createRouteMockJob,
  jobsRouteFixture
} from '@e2e/fixtures/jobsRouteFixture'
import { TestIds } from '@e2e/fixtures/selectors'
import { webSocketFixture } from '@e2e/fixtures/ws'
import type { RawJobListItem } from '@/platform/remote/comfyui/jobs/jobTypes'

const test = mergeTests(comfyPageFixture, jobsRouteFixture, webSocketFixture)
const mockJobTimestamp = Date.UTC(2026, 0, 1, 12)
const targetJobId = '00000000-0000-4000-8000-000000000002'

const MOCK_JOBS: RawJobListItem[] = [
  createRouteMockJob({
    id: 'job-completed-1',
    status: 'completed',
    create_time: mockJobTimestamp - 60_000,
    execution_start_time: mockJobTimestamp - 60_000,
    execution_end_time: mockJobTimestamp - 50_000,
    outputs_count: 2
  }),
  createRouteMockJob({
    id: targetJobId,
    status: 'completed',
    create_time: mockJobTimestamp - 120_000,
    execution_start_time: mockJobTimestamp - 120_000,
    execution_end_time: mockJobTimestamp - 115_000,
    preview_output: {
      filename: 'workflow-output.png',
      subfolder: '',
      type: 'output',
      nodeId: '1',
      mediaType: 'images'
    },
    outputs_count: 1
  }),
  createRouteMockJob({
    id: 'job-failed-1',
    status: 'failed',
    create_time: mockJobTimestamp - 30_000,
    execution_start_time: mockJobTimestamp - 30_000,
    execution_end_time: mockJobTimestamp - 28_000,
    outputs_count: 0
  }),
  createRouteMockJob({
    id: 'job-failed-bottom',
    status: 'failed',
    create_time: mockJobTimestamp - 180_000,
    execution_start_time: mockJobTimestamp - 180_000,
    execution_end_time: mockJobTimestamp - 178_000,
    outputs_count: 0
  })
]

test.describe('Queue overlay', () => {
  test.beforeEach(async ({ comfyPage, jobsRoutes }) => {
    await jobsRoutes.mockJobsScenario({ history: MOCK_JOBS, queue: [] })
    await comfyPage.page.route(/\/api\/assets(?:\?.*)?$/, async (route) => {
      await route.fulfill({
        json: {
          assets: [
            {
              id: '10000000-0000-4000-8000-000000000002',
              name: 'workflow-output.png',
              mime_type: 'image/png',
              tags: ['output'],
              job_id: MOCK_JOBS[1].id,
              created_at: '2026-08-30T00:00:00Z',
              updated_at: '2026-08-30T00:00:00Z'
            }
          ],
          total: 1,
          has_more: false
        } satisfies ListAssetsResponse
      })
    })
    await comfyPage.settings.setSetting('Comfy.Minimap.Visible', false)
    await comfyPage.settings.setSetting('Comfy.Queue.QPOV2', false)
    // oxlint-disable-next-line comfy/no-comfy-page-setup-call -- pre-existing call, tracked by evfail-23; not fixed in this pass
    await comfyPage.setup()
  })

  test('Toggle button opens expanded queue overlay', async ({ comfyPage }) => {
    const toggle = comfyPage.page.getByTestId(TestIds.queue.overlayToggle)
    await toggle.click()

    // Expanded overlay should show job items
    await expect(comfyPage.page.locator('[data-job-id]').first()).toBeVisible()
  })

  test('Overlay shows filter tabs (All, Completed)', async ({ comfyPage }) => {
    const toggle = comfyPage.page.getByTestId(TestIds.queue.overlayToggle)
    await toggle.click()

    await expect(
      comfyPage.page.getByRole('button', { name: 'All', exact: true })
    ).toBeVisible()
    await expect(
      comfyPage.page.getByRole('button', { name: 'Completed', exact: true })
    ).toBeVisible()
  })

  test('Overlay shows Failed tab when failed jobs exist', async ({
    comfyPage
  }) => {
    const toggle = comfyPage.page.getByTestId(TestIds.queue.overlayToggle)
    await toggle.click()

    await expect(comfyPage.page.locator('[data-job-id]').first()).toBeVisible()

    await expect(
      comfyPage.page.getByRole('button', { name: 'Failed', exact: true })
    ).toBeVisible()
  })

  test('Completed filter shows only completed jobs', async ({ comfyPage }) => {
    const toggle = comfyPage.page.getByTestId(TestIds.queue.overlayToggle)
    await toggle.click()

    await expect(comfyPage.page.locator('[data-job-id]').first()).toBeVisible()

    await comfyPage.page
      .getByRole('button', { name: 'Completed', exact: true })
      .click()

    await expect(
      comfyPage.page.locator('[data-job-id="job-completed-1"]')
    ).toBeVisible()
    await expect(
      comfyPage.page.locator('[data-job-id="job-failed-1"]')
    ).toBeHidden()
  })

  test('Toggling overlay again closes it', async ({ comfyPage }) => {
    const toggle = comfyPage.page.getByTestId(TestIds.queue.overlayToggle)
    await toggle.click()

    await expect(comfyPage.page.locator('[data-job-id]').first()).toBeVisible()

    await toggle.click()

    await expect(comfyPage.page.locator('[data-job-id]').first()).toBeHidden()
  })

  test.describe('workflow output focus', () => {
    test.use({
      initialFeatureFlags: { assets: true },
      initialSettings: { 'Comfy.Assets.UseAssetAPI': true }
    })

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.workflow.setupWorkflowsDirectory({})
    })

    test('focuses the restored workflow output in Assets', async ({
      comfyPage,
      getWebSocket
    }) => {
      const workflowName = `assets-output-focus-${Date.now().toString(36)}`
      const job = MOCK_JOBS[1]
      const nodeId = '1'
      const output = {
        images: [
          {
            filename: 'workflow-output.png',
            subfolder: '',
            type: 'output'
          }
        ]
      }
      const ws = await getWebSocket()
      const execution = new ExecutionHelper(comfyPage, ws)

      await comfyPage.featureFlags.setServerFlagsPersistent({ assets: true })
      await comfyPage.settings.setSetting(
        'Comfy.Workflow.WorkflowTabsPosition',
        'Sidebar'
      )
      await comfyPage.menu.workflowsTab.open()
      await comfyPage.menu.topbar.saveWorkflow(workflowName)
      execution.executed(job.id, nodeId, output)
      await expect
        .poll(() =>
          comfyPage.page.evaluate(
            ([id]) => window.app!.nodeOutputs[id],
            [nodeId]
          )
        )
        .toEqual(output)

      await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
      await comfyPage.workflow.waitForWorkflowIdle()
      await expect
        .poll(() =>
          comfyPage.page.evaluate(
            ([id]) => window.app!.nodeOutputs[id],
            [nodeId]
          )
        )
        .toBeUndefined()

      await comfyPage.menu.workflowsTab.getPersistedItem(workflowName).click()
      await comfyPage.workflow.waitForWorkflowIdle()
      await expect
        .poll(() =>
          comfyPage.page.evaluate(
            ([id]) => window.app!.nodeOutputs[id],
            [nodeId]
          )
        )
        .toEqual(output)

      await comfyPage.menu.assetsTab.open({ waitForAssets: false })
      await expect(
        comfyPage.menu.assetsTab.getAssetCardByName('workflow-output')
      ).toBeVisible()
      await comfyPage.menu.workflowsTab.open()

      await comfyPage.page.getByTestId(TestIds.queue.overlayToggle).click()
      const jobRow = comfyPage.page.locator(`[data-job-id="${job.id}"]`)
      await jobRow.hover()
      await jobRow.getByRole('button', { name: 'View' }).click()

      await expect(comfyPage.menu.assetsTab.generatedTab).toBeVisible()
      await expect(comfyPage.menu.assetsTab.selectedCards).toHaveCount(1)
      await expect(comfyPage.menu.assetsTab.selectedCards).toHaveAttribute(
        'data-asset-id',
        job.id
      )
      await expect
        .poll(() =>
          comfyPage.page.evaluate(
            ([id]) => window.app!.nodeOutputs[id],
            [nodeId]
          )
        )
        .toEqual(output)
    })
  })

  test('Job details popover stays inside the viewport for bottom rows', async ({
    comfyPage
  }) => {
    await comfyPage.page.setViewportSize({ width: 1280, height: 420 })

    const toggle = comfyPage.page.getByTestId(TestIds.queue.overlayToggle)
    await toggle.click()

    const bottomJob = comfyPage.page.locator(
      '[data-job-id="job-failed-bottom"]'
    )
    await expect(bottomJob).toBeVisible()
    await bottomJob.scrollIntoViewIfNeeded()
    await expect(bottomJob).toBeVisible()

    const viewportSize = comfyPage.page.viewportSize()
    if (!viewportSize) throw new Error('Viewport must be available')

    const rowBox = await bottomJob.boundingBox()
    if (!rowBox) throw new Error('Bottom job row should be measurable')
    expect(
      rowBox.y + rowBox.height,
      'Test row should be low enough to exercise bottom-edge collision handling'
    ).toBeGreaterThan(viewportSize.height * 0.55)
    await expect
      .poll(async () =>
        bottomJob.evaluate((element) => {
          const rect = element.getBoundingClientRect()
          const hitTarget = document.elementFromPoint(
            rect.x + rect.width / 2,
            rect.y + rect.height / 2
          )
          return hitTarget ? element.contains(hitTarget) : false
        })
      )
      .toBe(true)

    await comfyPage.page.mouse.move(0, 0)
    await comfyPage.page.mouse.move(
      rowBox.x + rowBox.width / 2,
      rowBox.y + rowBox.height / 2,
      { steps: 5 }
    )

    const popover = comfyPage.page.getByTestId(TestIds.queue.jobDetailsPopover)
    await expect(popover).toBeVisible()

    await expect
      .poll(async () => {
        const popoverBox = await popover.boundingBox()
        if (!popoverBox) return false

        return (
          popoverBox.y >= 0 &&
          popoverBox.y + popoverBox.height <= viewportSize.height
        )
      })
      .toBe(true)
  })
})
