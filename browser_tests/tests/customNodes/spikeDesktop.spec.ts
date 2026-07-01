import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { collectConsoleErrors } from '@e2e/fixtures/utils/consoleErrorCollector'
import { assetPath } from '@e2e/fixtures/utils/paths'

const defaultWorkflow = JSON.parse(
  readFileSync(resolve(assetPath('default.json')), 'utf-8')
) as ComfyWorkflowJSON

test.describe('smoke: default workflow', () => {
  test('loads without console errors in both renderers', async ({
    comfyPage
  }) => {
    for (const vueNodesEnabled of [false, true]) {
      const consoleErrors = collectConsoleErrors(comfyPage.page)
      await comfyPage.settings.setSetting(
        'Comfy.VueNodes.Enabled',
        vueNodesEnabled
      )
      await comfyPage.workflow.loadGraphData(defaultWorkflow)
      await comfyPage.nextFrame()
      consoleErrors.stop()

      expect(await comfyPage.nodeOps.getGraphNodesCount()).toBeGreaterThan(0)
      expect(
        consoleErrors.errors,
        `console errors (VueNodes=${vueNodesEnabled})`
      ).toEqual([])
    }
  })
})
