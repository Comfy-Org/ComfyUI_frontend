import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

// Boot every session with a blank graph (loadBlankWorkflow) instead of the
// bundled default template, whose model references error on the model-less
// harness backend and would trip the zero-visible-errors invariant.
// Comfy.userId must be 'default': the harness backend runs single-user
// server storage, so the browser session always reads users/default/ - the
// devtools set_settings endpoint must write there or no pre-boot setting
// (including this one) ever reaches the session.
// The shared fixture disables the errors tab to hide missing-model
// indicators in unrelated suites; this suite exists to SEE errors, so every
// error surface stays live.
export const customNodeSuiteSettings = {
  'Comfy.TutorialCompleted': false,
  'Comfy.userId': 'default',
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
