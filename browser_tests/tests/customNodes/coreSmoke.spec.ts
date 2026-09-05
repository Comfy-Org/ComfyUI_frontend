import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { validateComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { isForeignExecutionNoise } from '@e2e/fixtures/customNode/consoleErrorLedger'
import {
  customNodeSuiteSettings,
  drainBackendToIdle,
  runWithCollectedCleanup,
  submittedPromptCount,
  trackSubmittedPrompts
} from '@e2e/fixtures/utils/customNodeSuite'
import { collectConsoleErrors } from '@e2e/fixtures/utils/consoleErrorCollector'
import { expectNoVisibleErrors } from '@e2e/fixtures/utils/errorSurfaces'
import { assetPath } from '@e2e/fixtures/utils/paths'

// Core-only, model-free workflow: the bundled default template references
// model files a scoped test backend does not have, which rightly trips the
// error surfaces this suite asserts are clean.
const smokeWorkflowInput: unknown = JSON.parse(
  readFileSync(resolve(assetPath('customNodes/core_smoke.json')), 'utf-8')
)

test.use({ initialSettings: customNodeSuiteSettings })

test.beforeEach(async ({ comfyPage }) => {
  trackSubmittedPrompts(comfyPage.page)
})

// This spec queues no prompt of its own, so the drain returns without a
// round-trip; it stays as the guard for pack JS that queues one behind our
// back, which would otherwise run on into the next test.
test.afterEach(async ({ comfyPage }) => {
  await runWithCollectedCleanup(async () => {
    expect(
      await submittedPromptCount(comfyPage.page),
      'core smoke submitted a prompt'
    ).toBe(0)
  }, [
    async () => {
      expect(
        await drainBackendToIdle(comfyPage.page, 10_000),
        'smoke test left test-owned backend work running'
      ).toBe(0)
    }
  ])
})

test.describe('smoke: core workflow @custom-nodes', () => {
  test('starts without onboarding and with a blank graph', async ({
    comfyPage
  }) => {
    await expect(
      comfyPage.templatesDialog.root.filter({
        has: comfyPage.page.getByTestId('template-filter-bar')
      })
    ).toBeHidden()
    await expect(
      comfyPage.page.getByTestId('getting-started-blank')
    ).toBeHidden()
    expect(await comfyPage.nodeOps.getGraphNodesCount()).toBe(0)
  })

  test('loads without console errors in both renderers', async ({
    comfyPage
  }) => {
    const validationErrors: string[] = []
    const smokeWorkflow = await validateComfyWorkflow(
      smokeWorkflowInput,
      (error) => validationErrors.push(error)
    )
    expect(validationErrors, 'core smoke fixture schema errors').toEqual([])
    expect(
      smokeWorkflow,
      'core smoke fixture must be a valid workflow'
    ).not.toBeNull()
    if (!smokeWorkflow) throw new Error('core smoke fixture validation failed')
    for (const vueNodesEnabled of [false, true]) {
      const consoleErrors = collectConsoleErrors(comfyPage.page)
      await comfyPage.settings.setSetting(
        'Comfy.VueNodes.Enabled',
        vueNodesEnabled
      )
      await comfyPage.workflow.loadGraphData(smokeWorkflow)
      await comfyPage.nextFrame()
      consoleErrors.stop()

      await expect
        .poll(() => comfyPage.nodeOps.getGraphNodesCount())
        .toBeGreaterThan(0)
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
