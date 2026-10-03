import type { Page } from '@playwright/test'

import { WORKSPACE_INSET_RIGHT } from '@/composables/useWorkspaceInset'

/** `PANEL_MIN_WIDTH` in `agentPanelStore` — the narrowest docked Agent panel. */
export const DOCKED_AGENT_PANEL_WIDTH = 420

/** Half of the `1rem` gutter `dialogContentVariants` reserves around a dialog. */
export async function dialogViewportGutter(page: Page): Promise<number> {
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
export async function publishWorkspaceInsetRight(
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
