import type { Locator } from '@playwright/test'
import { mergeTests } from '@playwright/test'

import type { NodeExecutionOutput } from '@comfyorg/api-client/executionTypes'
import {
  createRouteMockJob,
  jobsRouteFixture
} from '@e2e/fixtures/jobsRouteFixture'
import { queuedExecutionFixture } from '@e2e/fixtures/queuedExecutionFixture'
import { assetPath } from '@e2e/fixtures/utils/paths'
import { mockViewFiles } from '@e2e/fixtures/utils/viewFileMocks'

interface CompositorFixture {
  closeEditor: Locator
  dogLayer: Locator
  openEditor: Locator
  output: (filename: string) => NodeExecutionOutput
  preview: Locator
  prompt: Locator
  showRunningJobs: (cat: string, sheep: string) => Promise<void>
  x: Locator
}

export const compositorFixture = mergeTests(
  queuedExecutionFixture,
  jobsRouteFixture
).extend<{
  compositor: CompositorFixture
}>({
  async compositor({ comfyPage, queuedExecution, jobsRoutes }, use) {
    const { page, vueNodes } = comfyPage
    const park = { filename: 'park.webp', type: 'temp' }
    const dog = { filename: 'dog.webp', type: 'temp' }
    function webp(file: string) {
      return { contentType: 'image/webp', path: assetPath(file) }
    }

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
      output(filename) {
        return {
          images: [{ filename, type: 'temp' }],
          compositor_layers: [park, dog],
          compositor_inputs: ['park', 'dog'],
          compositor_canvas: [{ w: 64, h: 64 }]
        }
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
        queuedExecution.status(2)
      }
    })
  }
})
