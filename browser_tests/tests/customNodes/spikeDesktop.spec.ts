import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import type { ConsoleMessage } from '@playwright/test'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

const defaultWorkflow = JSON.parse(
  readFileSync(resolve('browser_tests/assets/default.json'), 'utf-8')
) as ComfyWorkflowJSON

test.describe('Phase 0 spike: drive the running ComfyUI backend', () => {
  test('loads the default workflow without console errors in both renderers', async ({
    comfyPage
  }) => {
    for (const vueNodesEnabled of [false, true]) {
      await comfyPage.settings.setSetting(
        'Comfy.VueNodes.Enabled',
        vueNodesEnabled
      )

      const errors: string[] = []
      const collect = (message: ConsoleMessage) => {
        if (message.type() === 'error') errors.push(message.text())
      }
      comfyPage.page.on('console', collect)

      // Load only: the default graph needs a model + GPU to execute.
      await comfyPage.workflow.loadGraphData(defaultWorkflow)
      await comfyPage.nextFrame()
      comfyPage.page.off('console', collect)

      expect(await comfyPage.nodeOps.getGraphNodesCount()).toBeGreaterThan(0)
      expect(errors, `console errors (VueNodes=${vueNodesEnabled})`).toEqual([])
    }
  })
})
