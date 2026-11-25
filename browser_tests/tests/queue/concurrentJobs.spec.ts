import { mergeTests } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import {
  createRouteMockJob,
  jobsRouteFixture
} from '@e2e/fixtures/jobsRouteFixture'
import { queuedExecutionFixture } from '@e2e/fixtures/queuedExecutionFixture'

const test = mergeTests(queuedExecutionFixture, jobsRouteFixture)

const image = { filename: 'example.png', type: 'input' }
function images(count: number) {
  return { images: Array(count).fill(image) }
}

async function previewImageTab(comfyPage: ComfyPage) {
  await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
  await comfyPage.searchBoxV2.addNode('Preview Image')
  return comfyPage.vueNodes.getFixtureByTitle('Preview Image')
}

test.describe('Concurrent jobs', { tag: ['@vue-nodes', '@ui'] }, () => {
  test('follows one focused job across tabs while every job reports progress', async ({
    comfyPage,
    queuedExecution,
    jobsRoutes
  }) => {
    const { queuePanel, runButton } = comfyPage
    const { topbar } = comfyPage.menu

    await previewImageTab(comfyPage)
    const jobA = await queuedExecution.capture(() => runButton.click())
    const tabA = topbar.getTab(1)

    const nodeB = await previewImageTab(comfyPage)
    const jobB1 = await queuedExecution.capture(() => runButton.click())
    const jobB2 = await queuedExecution.capture(() => runButton.click())

    await jobsRoutes.mockJobsScenario({
      history: [],
      queue: [jobA, jobB1, jobB2].map(({ id }) =>
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
    jobB1.start()
    jobA.start()
    jobB2.start()
    queuedExecution.status(3)

    await test.step('every running job shows its own progress', async () => {
      await comfyPage.settings.setSetting('Comfy.Queue.History.Expanded', true)
      await expect(queuePanel.jobAssetsList).toBeVisible()
      jobA.progress('1', 2, 10)
      jobB1.progress('1', 5, 10)
      jobB2.progress('1', 8, 10)

      await expect(queuePanel.jobRow(jobA.id)).toContainText(': 20%')
      await expect(queuePanel.jobRow(jobB1.id)).toContainText(': 50%')
      await expect(queuePanel.jobRow(jobB2.id)).toContainText(': 80%')
    })

    await test.step('only the focused job draws outputs', async () => {
      jobB1.output('1', images(2))
      await expect(nodeB.imageGrid.locator('img')).toHaveCount(2)

      jobB2.output('1', images(3))
      jobA.output('1', images(4))
      jobB2.progress('1', 9, 10)
      await expect(queuePanel.jobRow(jobB2.id)).toContainText(': 90%')

      await expect(nodeB.imageGrid.locator('img')).toHaveCount(2)
    })

    await test.step('the newest job of the tab takes over when the focused one finishes', async () => {
      jobB1.finish()
      jobB2.output('1', images(3))

      await expect(nodeB.imageGrid.locator('img')).toHaveCount(3)
    })

    await test.step('clicking a job from another tab switches to it', async () => {
      await queuePanel.jobRow(jobA.id).getByText(': 20%').click()

      await expect(tabA.and(topbar.getActiveTab())).toBeVisible()
      const nodeA = await comfyPage.vueNodes.getFixtureByTitle('Preview Image')
      await expect(nodeA.imageGrid.locator('img')).toHaveCount(4)
    })
  })
})
