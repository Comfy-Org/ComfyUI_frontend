import type { Locator } from '@playwright/test'
import { mergeTests } from '@playwright/test'

import type { NodeExecutionOutput } from '@comfyorg/api-client/executionTypes'
import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import {
  createRouteMockJob,
  jobsRouteFixture
} from '@e2e/fixtures/jobsRouteFixture'
import { queuedExecutionFixture } from '@e2e/fixtures/queuedExecutionFixture'
import { assetPath } from '@e2e/fixtures/utils/paths'
import { mockViewFiles } from '@e2e/fixtures/utils/viewFileMocks'

interface CompositorFixture {
  preview: Locator
  openEditor: Locator
  dogLayer: Locator
  x: Locator
  closeEditor: Locator
  prompt: Locator
  output: (filename: string) => NodeExecutionOutput
  showRunningJobs: (cat: string, sheep: string) => Promise<void>
}

const test = mergeTests(queuedExecutionFixture, jobsRouteFixture).extend<{
  compositor: CompositorFixture
}>({
  compositor: async ({ comfyPage, queuedExecution, jobsRoutes }, use) => {
    const { page, vueNodes } = comfyPage
    const park = { filename: 'park.webp', type: 'temp' }
    const dog = { filename: 'dog.webp', type: 'temp' }
    const webp = (file: string) => ({
      contentType: 'image/webp',
      path: assetPath(file)
    })

    await mockViewFiles(page, {
      'park.webp': webp('image64x64.webp'),
      'dog.webp': webp('image32x32.webp'),
      'dog-result.webp': webp('image64x64.webp'),
      'cat-result.webp': webp('image32x32.webp'),
      'sheep-result.webp': webp('example.webp')
    })
    await comfyPage.workflow.loadWorkflow('layerEditor/concurrentCompositor')
    const dialog = page.getByRole('dialog').filter({
      has: page.getByTestId('layer-panel-row')
    })

    await use({
      preview: page.getByTestId('compositor-preview'),
      openEditor: page.getByTestId('compositor-open-button'),
      dogLayer: dialog
        .getByTestId('layer-panel-row')
        .filter({ hasText: 'dog' }),
      x: dialog.getByRole('spinbutton', { name: 'X', exact: true }),
      closeEditor: dialog.getByRole('button', { name: 'Close', exact: true }),
      prompt: vueNodes.getWidgetByName('Animal prompt', 'text'),
      output: (filename) => ({
        images: [{ filename, type: 'temp' }],
        compositor_layers: [park, dog],
        compositor_inputs: ['park', 'dog'],
        compositor_canvas: [{ w: 64, h: 64 }]
      }),
      async showRunningJobs(cat: string, sheep: string) {
        await jobsRoutes.mockJobsScenario({
          history: [],
          queue: [cat, sheep].map((id) =>
            createRouteMockJob({
              id,
              status: 'in_progress',
              execution_end_time: undefined,
              preview_output: undefined,
              outputs_count: 0
            })
          )
        })
        queuedExecution.status(2)
      }
    })
  }
})

test.use({ initialSettings: { 'Comfy.Queue.History.Expanded': true } })

test(
  'shows the selected concurrent job’s compositor result after a saved edit',
  {
    tag: ['@vue-nodes', '@ui']
  },
  async ({ comfyPage, compositor, queuedExecution }) => {
    const { preview } = compositor
    const { queuePanel, runButton } = comfyPage

    await test.step('arrange the dog and render the saved composition', async () => {
      const initial = await queuedExecution.capture(() => runButton.click())
      initial.start()
      initial.output('1', compositor.output('park.webp'))
      initial.finish()

      await compositor.openEditor.click()
      await compositor.dogLayer.click()
      await compositor.x.fill('12')
      await compositor.x.press('Tab')
      await expect(compositor.x).toHaveValue('12')
      await compositor.closeEditor.click()
      await expect(preview).toHaveAttribute('src', /^blob:/)

      const dog = await queuedExecution.capture(() => runButton.click())
      dog.start()
      dog.output('1', compositor.output('dog-result.webp'))
      dog.finish()
      await expect(preview).toHaveAttribute('src', /filename=dog-result\.webp/)
    })

    await test.step('keep the cat visible while the sheep run reports output', async () => {
      await compositor.prompt.fill('cat')
      const cat = await queuedExecution.capture(() => runButton.click())
      cat.start()
      await compositor.prompt.fill('sheep')
      const sheep = await queuedExecution.capture(() => runButton.click())
      sheep.start()
      await compositor.showRunningJobs(cat.id, sheep.id)

      cat.output('1', compositor.output('cat-result.webp'))
      await expect(preview).toHaveAttribute('src', /filename=cat-result\.webp/)

      sheep.output('1', compositor.output('sheep-result.webp'))
      sheep.progress('2', 4, 10)
      const sheepProgress = queuePanel.jobRow(sheep.id).getByText(': 40%')
      await expect(sheepProgress).toBeVisible()
      await expect(preview).toHaveAttribute('src', /filename=cat-result\.webp/)

      await sheepProgress.click()
      await expect(preview).toHaveAttribute(
        'src',
        /filename=sheep-result\.webp/
      )
    })
  }
)
