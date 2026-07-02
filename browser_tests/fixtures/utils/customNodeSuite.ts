import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

// Boot every session with a blank graph (loadBlankWorkflow) instead of the
// bundled default template, whose model references error on a model-less
// harness backend and would trip the zero-visible-errors invariant. The
// backend must run --multi-user (the repo-wide prerequisite for browser
// tests): the fixture then writes these settings to the same per-worker
// user the session reads, on CI and locally alike.
// The shared fixture disables the errors tab to hide missing-model
// indicators in unrelated suites; this suite exists to SEE errors, so every
// error surface stays live.
export const customNodeSuiteSettings = {
  'Comfy.TutorialCompleted': false,
  'Comfy.RightSidePanel.ShowErrorsTab': true
}

// The tutorial path auto-opens the templates browser over the blank graph.
// Dismiss it deterministically so no window ever shows unexpected UI.
export async function dismissTemplatesDialog(
  comfyPage: ComfyPage
): Promise<void> {
  const templates = comfyPage.page.getByTestId(TestIds.templates.content)
  await templates.waitFor({ state: 'visible' })
  await comfyPage.page.keyboard.press('Escape')
  await templates.waitFor({ state: 'hidden' })
}
