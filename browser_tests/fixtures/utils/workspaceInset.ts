import type { Locator, Page } from '@playwright/test'

import { WORKSPACE_INSET_RIGHT } from '@/composables/useWorkspaceInset'
import { comfyExpect } from '@e2e/fixtures/utils/customMatchers'

export async function expectDialogBoundsWithDockedPanel(
  page: Page,
  dialog: Locator,
  { panelWidth, x }: { panelWidth: number; x: number }
): Promise<void> {
  await comfyExpect
    .poll(() => dialog.evaluate((element) => element.getAnimations().length))
    .toBe(0)
  const withoutPanel = await dialog.boundingBox()
  if (!withoutPanel) throw new Error('Dialog is not laid out')

  await page.evaluate(
    ({ property, panelWidth }) => {
      document.documentElement.style.setProperty(property, `${panelWidth}px`)
    },
    { property: WORKSPACE_INSET_RIGHT, panelWidth }
  )

  await comfyExpect(dialog).toHaveBounds(
    { ...withoutPanel, x },
    { numDigits: 1 }
  )
}
