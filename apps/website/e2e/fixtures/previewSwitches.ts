import type { BrowserContext } from '@playwright/test'

/** Opens Workflows in its sectioned catalogue instead of the default modality › task preview. */
export async function pinSectionedWorkflows(context: BrowserContext) {
  await context.addInitScript(() => {
    window.localStorage.setItem(
      'comfy-preview-switch:hub-workflows-modality-task',
      'off'
    )
  })
}
