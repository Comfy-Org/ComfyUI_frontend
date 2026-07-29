import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { isForeignExecutionNoise } from '@e2e/fixtures/customNode/consoleErrorLedger'
import {
  customNodeSuiteSettings,
  dismissTemplatesDialog,
  drainBackendToIdle,
  trackSubmittedPrompts
} from '@e2e/fixtures/utils/customNodeSuite'
import { collectConsoleErrors } from '@e2e/fixtures/utils/consoleErrorCollector'
import { expectNoVisibleErrors } from '@e2e/fixtures/utils/errorSurfaces'
import { assetPath } from '@e2e/fixtures/utils/paths'

// Core-only, model-free workflow: the bundled default template references
// model files a scoped test backend does not have, which rightly trips the
// error surfaces this suite asserts are clean.
const smokeWorkflow = JSON.parse(
  readFileSync(resolve(assetPath('customNodes/core_smoke.json')), 'utf-8')
) as ComfyWorkflowJSON

test.use({ initialSettings: customNodeSuiteSettings })

test.beforeEach(async ({ comfyPage }) => {
  trackSubmittedPrompts(comfyPage.page)
  await dismissTemplatesDialog(comfyPage)
})

// This spec queues no prompt of its own, so the drain returns without a
// round-trip; it stays as the guard for pack JS that queues one behind our
// back, which would otherwise run on into the next test.
test.afterEach(async ({ comfyPage }) => {
  await drainBackendToIdle(comfyPage.page, 10_000)
})

test.describe('smoke: core workflow @custom-nodes', () => {
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
      // Core smoke loads a graph but queues no prompt; a prompt-execution
      // error here is a prior tier's async stray (isForeignExecutionNoise).
      expect(
        consoleErrors.errors.filter((error) => !isForeignExecutionNoise(error)),
        `console errors (VueNodes=${vueNodesEnabled})`
      ).toEqual([])
      await expectNoVisibleErrors(comfyPage.page, `VueNodes=${vueNodesEnabled}`)
    }
  })
})
