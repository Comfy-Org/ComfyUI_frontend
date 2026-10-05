import type { Locator, Page } from '@playwright/test'

import { WORKSPACE_INSET_RIGHT } from '@/composables/useWorkspaceInset'
import { comfyExpect } from '@e2e/fixtures/utils/customMatchers'

export async function expectDialogBoundsWithDockedPanel(
  page: Page,
  dialog: Locator,
  { panelWidths }: { panelWidths: number[] }
): Promise<void> {
  await comfyExpect
    .poll(() => dialog.evaluate((element) => element.getAnimations().length))
    .toBe(0)
  const withoutPanel = await dialog.boundingBox()
  if (!withoutPanel) throw new Error('Dialog is not laid out')
  const viewport = page.viewportSize()
  if (!viewport) throw new Error('Viewport size not available')

  await comfyExpect(dialog).toHaveBounds(
    {
      ...withoutPanel,
      x: (viewport.width - withoutPanel.width) / 2,
      y: (viewport.height - withoutPanel.height) / 2
    },
    { numDigits: 1 }
  )

  for (const panelWidth of panelWidths) {
    await page.evaluate(
      ({ property, panelWidth }) => {
        document.documentElement.style.setProperty(property, `${panelWidth}px`)
      },
      { property: WORKSPACE_INSET_RIGHT, panelWidth }
    )

    await comfyExpect(dialog).toHaveBounds(withoutPanel, { numDigits: 1 })
  }
}
