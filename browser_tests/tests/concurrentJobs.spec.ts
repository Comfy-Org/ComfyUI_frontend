import { mergeTests } from '@playwright/test'

import {
  comfyExpect as expect,
  comfyPageFixture
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import {
  createRouteMockJob,
  jobsRouteFixture
} from '@e2e/fixtures/jobsRouteFixture'
import { webSocketFixture } from '@e2e/fixtures/ws'

const test = mergeTests(comfyPageFixture, webSocketFixture, jobsRouteFixture)

const image = { filename: 'example.png', type: 'input' }
const images = (count: number) => ({ images: Array(count).fill(image) })

async function previewImageTab(comfyPage: ComfyPage) {
  await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
  await comfyPage.searchBoxV2.addNode('Preview Image')
  return comfyPage.vueNodes.getFixtureByTitle('Preview Image')
}

test.describe('Concurrent jobs', { tag: ['@vue-nodes', '@ui'] }, () => {
  test('follows one focused job across tabs while every job reports progress', async ({
    comfyPage,
    getWebSocket,
    jobsRoutes
  }) => {
    const execution = new ExecutionHelper(comfyPage, await getWebSocket())
    const { queuePanel } = comfyPage
    const { topbar } = comfyPage.menu

    await previewImageTab(comfyPage)
    const jobA = await execution.run({ start: false })
    const tabA = topbar.getTab(1)

    const nodeB = await previewImageTab(comfyPage)
    const jobB1 = await execution.run({ start: false })
    const jobB2 = await execution.run({ start: false })

    await jobsRoutes.mockJobsScenario({
      history: [],
      queue: [jobA, jobB1, jobB2].map((id) =>
        createRouteMockJob({
          id,
          status: 'in_progress',
          create_time: Date.now(),
          execution_end_time: undefined,
          preview_output: undefined,
          outputs_count: 0
        })
      )
    })
    execution.executionStart(jobB1)
    execution.executionStart(jobA)
    execution.executionStart(jobB2)
    execution.status(3)

    await test.step('every running job shows its own progress', async () => {
      await comfyPage.settings.setSetting('Comfy.Queue.History.Expanded', true)
      await expect(queuePanel.jobAssetsList).toBeVisible()
      execution.nodeRunning(jobA, '1', 2, 10)
      execution.nodeRunning(jobB1, '1', 5, 10)
      execution.nodeRunning(jobB2, '1', 8, 10)

      await expect(queuePanel.jobRow(jobA)).toContainText(': 20%')
      await expect(queuePanel.jobRow(jobB1)).toContainText(': 50%')
      await expect(queuePanel.jobRow(jobB2)).toContainText(': 80%')
    })

    await test.step('only the focused job draws outputs', async () => {
      execution.executed(jobB1, '1', images(2))
      await expect(nodeB.imageGrid.locator('img')).toHaveCount(2)

      execution.executed(jobB2, '1', images(3))
      execution.executed(jobA, '1', images(4))
      execution.nodeRunning(jobB2, '1', 9, 10)
      await expect(queuePanel.jobRow(jobB2)).toContainText(': 90%')

      await expect(nodeB.imageGrid.locator('img')).toHaveCount(2)
    })

    await test.step('the newest job of the tab takes over when the focused one finishes', async () => {
      execution.executionSuccess(jobB1)
      execution.executed(jobB2, '1', images(3))

      await expect(nodeB.imageGrid.locator('img')).toHaveCount(3)
    })

    await test.step('clicking a job from another tab switches to it', async () => {
      await queuePanel.jobRow(jobA).getByText(': 20%').click()

      await expect(tabA.and(topbar.getActiveTab())).toBeVisible()
      const nodeA = await comfyPage.vueNodes.getFixtureByTitle('Preview Image')
      await expect(nodeA.imageGrid.locator('img')).toHaveCount(4)
    })
  })
})
