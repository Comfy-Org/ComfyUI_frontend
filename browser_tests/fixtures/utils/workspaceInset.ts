import type { Locator, Page } from '@playwright/test'

import { WORKSPACE_INSET_RIGHT } from '@/composables/useWorkspaceInset'
import { comfyExpect } from '@e2e/fixtures/utils/customMatchers'

async function waitForStableDialogBounds(dialog: Locator): Promise<void> {
  await comfyExpect
    .poll(() =>
      dialog.evaluate(async (element) => {
        const nextFrame = () => new Promise(requestAnimationFrame)
        await nextFrame()
        const before = element.getBoundingClientRect()
        await nextFrame()
        const after = element.getBoundingClientRect()

        return (
          element.getAnimations().length === 0 &&
          before.x === after.x &&
          before.y === after.y &&
          before.width === after.width &&
          before.height === after.height
        )
      })
    )
    .toBe(true)
}

export async function expectDialogBoundsWithDockedPanel(
  page: Page,
  dialog: Locator,
  { panelWidths }: { panelWidths: number[] }
): Promise<void> {
  await waitForStableDialogBounds(dialog)
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

  try {
    for (const panelWidth of panelWidths) {
      await page.evaluate(
        ({ property, panelWidth }) => {
          document.documentElement.style.setProperty(
            property,
            `${panelWidth}px`
          )
        },
        { property: WORKSPACE_INSET_RIGHT, panelWidth }
      )

      await waitForStableDialogBounds(dialog)
      await comfyExpect(dialog).toHaveBounds(withoutPanel, { numDigits: 1 })
    }
  } finally {
    await page.evaluate((property) => {
      document.documentElement.style.removeProperty(property)
    }, WORKSPACE_INSET_RIGHT)
  }
}
