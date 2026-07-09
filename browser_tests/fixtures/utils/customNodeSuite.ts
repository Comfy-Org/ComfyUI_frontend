import type { Page } from '@playwright/test'

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

// Every test gets a fresh page, but they share ONE backend. An execution
// tier that ends while a prompt is still draining leaves that work running
// on the shared backend; the next test's fresh page connects mid-execution
// and catches its async error events (console noise, a popped error dialog)
// or its still-running prompt (queue-busy). Draining to idle in an afterEach
// - while the finishing test's own page is still open, so any late events
// land there - is what makes each test unable to affect the next. getQueue
// swallows a failed fetch and returns an empty queue, so throw-on-error and
// treat a failed read as still-busy; the wait is free when already idle
// (one getQueue round-trip), so a healthy suite pays ~nothing for it.
// Returns 0 when the backend reached idle, 1 when it was still busy after the
// budget (a genuinely wedged, non-interruptible execution). The afterEach hook
// ignores the result; the auto-run tier asserts on it.
export async function drainBackendToIdle(
  page: Page,
  budgetMs = 150_000
): Promise<number> {
  const depth = () =>
    page.evaluate(async () => {
      try {
        const queue = await window.app!.api.getQueue({ throwOnError: true })
        return queue.Running.length + queue.Pending.length
      } catch {
        return Number.POSITIVE_INFINITY
      }
    })
  if ((await depth()) === 0) return 0
  await page.evaluate(async () => {
    await window.app!.api.interrupt(null)
    await window.app!.api.clearItems('queue')
  })
  const deadline = Date.now() + budgetMs
  let remaining = await depth()
  while (remaining !== 0 && Date.now() < deadline) {
    await page.evaluate(
      () => new Promise((resolve) => setTimeout(resolve, 500))
    )
    remaining = await depth()
  }
  return remaining === 0 ? 0 : 1
}
