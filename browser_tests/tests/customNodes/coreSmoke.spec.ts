import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import {
  customNodeSuiteSettings,
  dismissTemplatesDialog
} from '@e2e/fixtures/utils/customNodeSuite'
import { collectConsoleErrors } from '@e2e/fixtures/utils/consoleErrorCollector'
import { errorSurfaces } from '@e2e/fixtures/utils/errorSurfaces'
import { assetPath } from '@e2e/fixtures/utils/paths'

// Core-only, model-free workflow: the bundled default template references
// model files a scoped test backend does not have, which rightly trips the
// error surfaces this suite asserts are clean.
const smokeWorkflow = JSON.parse(
  readFileSync(resolve(assetPath('customNodes/core_smoke.json')), 'utf-8')
) as ComfyWorkflowJSON

test.use({ initialSettings: customNodeSuiteSettings })

test.beforeEach(async ({ comfyPage }) => {
  await dismissTemplatesDialog(comfyPage)
})

test.describe('smoke: core workflow', () => {
  test('loads without console errors in both renderers', async ({
    comfyPage
  }) => {
    for (const vueNodesEnabled of [false, true]) {
      const consoleErrors = collectConsoleErrors(comfyPage.page)
      await comfyPage.settings.setSetting(
        'Comfy.VueNodes.Enabled',
        vueNodesEnabled
      )
      await comfyPage.workflow.loadGraphData(smokeWorkflow)
      await comfyPage.nextFrame()
      consoleErrors.stop()

      expect(await comfyPage.nodeOps.getGraphNodesCount()).toBeGreaterThan(0)
      expect(
        consoleErrors.errors,
        `console errors (VueNodes=${vueNodesEnabled})`
      ).toEqual([])
      for (const [surface, locator] of Object.entries(
        errorSurfaces(comfyPage.page)
      ))
        await expect(
          locator,
          `${surface} (VueNodes=${vueNodesEnabled})`
        ).toHaveCount(0)
    }
  })
})
