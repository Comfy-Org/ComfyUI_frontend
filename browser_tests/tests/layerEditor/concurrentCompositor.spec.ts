import type { Locator } from '@playwright/test'
import { mergeTests } from '@playwright/test'

import type { NodeExecutionOutput } from '@comfyorg/api-client/executionTypes'
import {
  comfyExpect as expect,
  comfyPageFixture
} from '@e2e/fixtures/ComfyPage'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import {
  createRouteMockJob,
  jobsRouteFixture
} from '@e2e/fixtures/jobsRouteFixture'
import { assetPath } from '@e2e/fixtures/utils/paths'
import { mockViewFiles } from '@e2e/fixtures/utils/viewFileMocks'
import { webSocketFixture } from '@e2e/fixtures/ws'

interface CompositorFixture {
  execution: ExecutionHelper
  preview: Locator
  openEditor: Locator
  dogLayer: Locator
  x: Locator
  closeEditor: Locator
  prompt: Locator
  executed: (job: string, filename: string) => void
  showRunningJobs: (cat: string, sheep: string) => Promise<void>
}

const test = mergeTests(
  comfyPageFixture,
  webSocketFixture,
  jobsRouteFixture
).extend<{ compositor: CompositorFixture }>({
  compositor: async ({ comfyPage, getWebSocket, jobsRoutes }, use) => {
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
    const execution = new ExecutionHelper(comfyPage, await getWebSocket())
    const dialog = page.getByRole('dialog').filter({
      has: page.getByTestId('layer-panel-row')
    })

    await use({
      execution,
      preview: page.getByTestId('compositor-preview'),
      openEditor: page.getByTestId('compositor-open-button'),
      dogLayer: dialog
        .getByTestId('layer-panel-row')
        .filter({ hasText: 'dog' }),
      x: dialog.getByRole('spinbutton', { name: 'X', exact: true }),
      closeEditor: dialog.getByRole('button', { name: 'Close', exact: true }),
      prompt: vueNodes.getWidgetByName('Animal prompt', 'text'),
      executed(job: string, filename: string) {
        const output: NodeExecutionOutput = {
          images: [{ filename, type: 'temp' }],
          compositor_layers: [park, dog],
          compositor_inputs: ['park', 'dog'],
          compositor_canvas: [{ w: 64, h: 64 }]
        }
        execution.executed(job, '1', output)
      },
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
        execution.status(2)
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
  async ({ comfyPage, compositor }) => {
    const { execution, preview } = compositor
    const { queuePanel } = comfyPage

    await test.step('arrange the dog and render the saved composition', async () => {
      const initial = await execution.run()
      compositor.executed(initial, 'park.webp')
      execution.executionSuccess(initial)

      await compositor.openEditor.click()
      await compositor.dogLayer.click()
      await compositor.x.fill('12')
      await compositor.x.press('Tab')
      await expect(compositor.x).toHaveValue('12')
      await compositor.closeEditor.click()
      await expect(preview).toHaveAttribute('src', /^blob:/)

      const dog = await execution.run()
      compositor.executed(dog, 'dog-result.webp')
      execution.executionSuccess(dog)
      await expect(preview).toHaveAttribute('src', /filename=dog-result\.webp/)
    })

    await test.step('keep the cat visible while the sheep run reports output', async () => {
      await compositor.prompt.fill('cat')
      const cat = await execution.run()
      await compositor.prompt.fill('sheep')
      const sheep = await execution.run()
      await compositor.showRunningJobs(cat, sheep)

      compositor.executed(cat, 'cat-result.webp')
      await expect(preview).toHaveAttribute('src', /filename=cat-result\.webp/)

      compositor.executed(sheep, 'sheep-result.webp')
      execution.nodeRunning(sheep, '2', 4, 10)
      const sheepProgress = queuePanel.jobRow(sheep).getByText(': 40%')
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
