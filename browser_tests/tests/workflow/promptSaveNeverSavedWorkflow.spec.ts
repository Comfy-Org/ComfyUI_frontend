import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { collectConsoleErrors } from '@e2e/fixtures/utils/consoleErrorCollector'

// Regression guard for the crash reproduced in isolation by
// comfyWorkflow.test.ts and, one call frame higher, by
// workflowService.test.ts's "propagates a promptSave() crash uncaught"
// case (PR #18121): ComfyWorkflow.promptSave() destructures
// `useDialogService` straight out of a dynamic
// `import('@/services/dialogService')`. If that import ever resolves
// without the expected export, the destructure throws instead of opening
// the filename prompt -- and per workflowService.test.ts, that throw is
// never caught, so it reaches the real "Save" command (Ctrl+S / File > Save)
// as an unhandled rejection.
//
// promptSave() *is* reachable through a completely ordinary UI interaction:
// saving a workflow that has never been saved before (`isTemporary`) routes
// through workflowService.saveWorkflow() -> saveWorkflowAs() ->
// workflow.promptSave(), exactly the "Unsaved Workflow" tab every fresh app
// load starts on. That path already has non-regression coverage today
// (menu.spec.ts's "Can close saved-workflow tabs", changeTracker.spec.ts).
//
// What is *not* forceable from here is the specific failure mode itself.
// `@/services/dialogService` is also imported statically -- and invoked
// eagerly at composable-construction time -- by src/scripts/app.ts,
// src/router.ts and workflowService.ts's own useWorkflowService(). Under
// real Vite/Rollup bundling those static importers and this dynamic
// import site necessarily resolve the same module instance from the same
// chunk, so there is no lever Playwright can pull (route mocking, timing,
// storage) that makes only this one call site see a broken module while
// every other, statically-bound consumer on the same page keeps working.
// Forcing it would mean faking the whole module graph, which would stop
// testing real bundling at all. See the PR description for the full
// reasoning and the two Vitest-level lenses used instead.
//
// This spec is therefore *not* a `test.fail()` repro. It is a permanent
// tripwire on the exact reachable path: if this timing condition ever does
// occur in CI (a different bundling configuration, a stale/poisoned chunk,
// etc.), it fails here with console/page-error evidence instead of only
// showing up as a silent, uncaught rejection in production.
test.describe('Save a never-saved workflow', { tag: ['@ui'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.workflow.setupWorkflowsDirectory({})
  })

  test('first Save on a fresh workflow completes without an uncaught crash', async ({
    comfyPage
  }) => {
    await expect
      .poll(() => comfyPage.menu.topbar.getTabNames())
      .toEqual(['Unsaved Workflow'])

    const consoleErrors = collectConsoleErrors(comfyPage.page)
    try {
      const workflowName = `promptSave-first-save-${test.info().title}`
      await comfyPage.menu.topbar.saveWorkflow(workflowName)

      await expect
        .poll(() => comfyPage.menu.topbar.getTabNames())
        .toEqual([workflowName])

      expect(
        consoleErrors.errors.filter((error) =>
          error.startsWith('Uncaught page error:')
        ),
        'Save must not surface an uncaught page error (see PR #18121)'
      ).toEqual([])
      expect(
        consoleErrors.errors.filter((error) =>
          error.includes('useDialogService')
        ),
        'promptSave() must not crash on the dialogService import (see PR #18121)'
      ).toEqual([])
    } finally {
      consoleErrors.stop()
    }
  })
})
