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

const promptRoute = '**/api/prompt'
const jobIds = ['initial-dog', 'dog', 'cat', 'sheep'] as const

interface CompositorFixture {
  preview: Locator
  openEditor: Locator
  dogLayer: Locator
  x: Locator
  closeEditor: Locator
  prompt: Locator
  start: (job: string) => Promise<void>
  render: (job: string, filename: string) => void
  finish: (job: string, filename: string) => void
  progress: (job: string, value: number, max: number) => void
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
    const jobs = jobIds.values()
    await page.route(promptRoute, async (route) => {
      if (route.request().method() !== 'POST') return route.fallback()
      const { value: jobId, done } = jobs.next()
      if (done) return route.fulfill({ status: 400 })
      await route.fulfill({ json: { prompt_id: jobId, node_errors: {} } })
    })
    const dialog = page.getByRole('dialog').filter({
      has: page.getByTestId('layer-panel-row')
    })
    const render = (job: string, filename: string) => {
      const output: NodeExecutionOutput = {
        images: [{ filename, type: 'temp' }],
        compositor_layers: [park, dog],
        compositor_inputs: ['park', 'dog'],
        compositor_canvas: [{ w: 64, h: 64 }]
      }
      execution.executed(job, '1', output)
    }

    await use({
      preview: page.getByTestId('compositor-preview'),
      openEditor: page.getByTestId('compositor-open-button'),
      dogLayer: dialog
        .getByTestId('layer-panel-row')
        .filter({ hasText: 'dog' }),
      x: dialog.getByRole('spinbutton', { name: 'X', exact: true }),
      closeEditor: dialog.getByRole('button', { name: 'Close', exact: true }),
      prompt: vueNodes.getWidgetByName('Animal prompt', 'text'),
      async start(job) {
        await page.waitForResponse(
          (response) =>
            new URL(response.url()).pathname === '/api/prompt' &&
            response.request().method() === 'POST' &&
            response.ok()
        )
        execution.executionStart(job)
      },
      render,
      finish(job, filename) {
        render(job, filename)
        execution.executionSuccess(job)
      },
      progress(job, value, max) {
        execution.nodeRunning(job, '2', value, max)
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
    const { preview } = compositor
    const { queuePanel, runButton } = comfyPage
    const [initial, dog, cat, sheep] = jobIds

    await test.step('arrange the dog and render the saved composition', async () => {
      await Promise.all([compositor.start(initial), runButton.click()])
      compositor.finish(initial, 'park.webp')

      await compositor.openEditor.click()
      await compositor.dogLayer.click()
      await compositor.x.fill('12')
      await compositor.x.press('Tab')
      await expect(compositor.x).toHaveValue('12')
      await compositor.closeEditor.click()
      await expect(preview).toHaveAttribute('src', /^blob:/)

      await Promise.all([compositor.start(dog), runButton.click()])
      compositor.finish(dog, 'dog-result.webp')
      await expect(preview).toHaveAttribute('src', /filename=dog-result\.webp/)
    })

    await test.step('keep the cat visible while the sheep run reports output', async () => {
      await compositor.prompt.fill('cat')
      await Promise.all([compositor.start(cat), runButton.click()])
      await compositor.prompt.fill('sheep')
      await Promise.all([compositor.start(sheep), runButton.click()])
      await compositor.showRunningJobs(cat, sheep)

      compositor.render(cat, 'cat-result.webp')
      await expect(preview).toHaveAttribute('src', /filename=cat-result\.webp/)

      compositor.render(sheep, 'sheep-result.webp')
      compositor.progress(sheep, 4, 10)
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
