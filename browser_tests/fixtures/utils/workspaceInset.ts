import type { Locator, Page } from '@playwright/test'

import { WORKSPACE_INSET_RIGHT } from '@/composables/useWorkspaceInset'
import { PANEL_MIN_WIDTH } from '@/workbench/extensions/agent/stores/agent/agentPanelConstants'
import { comfyExpect } from '@e2e/fixtures/utils/customMatchers'

/** Half of the `1rem` gutter `dialogContentVariants` reserves around a dialog. */
async function dialogViewportGutter(page: Page): Promise<number> {
  return page.evaluate(
    () => parseFloat(getComputedStyle(document.documentElement).fontSize) / 2
  )
}

/**
 * Declares the inset a docked right-hand surface publishes, standing in for the
 * Agent panel so layout can be exercised without the feature flags, consent and
 * backend a real panel needs. A real panel owns this property and rewrites it
 * whenever it resizes, so measure before resizing the viewport or opening one.
 */
async function publishWorkspaceInsetRight(
  page: Page,
  widthPx: number
): Promise<void> {
  await page.evaluate(
    ({ property, widthPx }) => {
      document.documentElement.style.setProperty(property, `${widthPx}px`)
    },
    { property: WORKSPACE_INSET_RIGHT, widthPx }
  )
}

/**
 * Measures an open dialog, docks a panel beside it, and requires the box to
 * keep every dimension while moving to the one position the layout allows:
 * centred in what the panel leaves, or the viewport gutter when that is less
 * than nothing.
 */
export async function expectDialogHoldsSizeWhenPanelDocks(
  page: Page,
  dialog: Locator,
  viewportWidth: number
): Promise<void> {
  await comfyExpect
    .poll(() => dialog.evaluate((element) => element.getAnimations().length))
    .toBe(0)
  const withoutPanel = await dialog.boundingBox()
  if (!withoutPanel) throw new Error('Dialog is not laid out')

  await publishWorkspaceInsetRight(page, PANEL_MIN_WIDTH)

  await comfyExpect(dialog).toHaveBounds(
    {
      ...withoutPanel,
      x: Math.max(
        await dialogViewportGutter(page),
        (viewportWidth - PANEL_MIN_WIDTH - withoutPanel.width) / 2
      )
    },
    { numDigits: 1 }
  )
}
