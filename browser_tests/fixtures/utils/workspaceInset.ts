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
 * centred in what the panel leaves, floored at the gutter, and the gutter
 * itself capped by whatever slack the dialog leaves inside the viewport — a
 * dialog as wide as the viewport has none to give.
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

  const gutter = await dialogViewportGutter(page)
  await comfyExpect(dialog).toHaveBounds(
    {
      ...withoutPanel,
      x: Math.max(
        Math.min(gutter, viewportWidth - withoutPanel.width),
        (viewportWidth - PANEL_MIN_WIDTH - withoutPanel.width) / 2
      )
    },
    { numDigits: 1 }
  )
}

/**
 * Opens a dialog and watches every frame of its entrance. Settled geometry
 * cannot see this: the zoom keyframes write `transform` wholesale, so a
 * horizontal offset parked on that property is animated up from zero and the
 * dialog flies in from off-screen before landing in the right place.
 */
export async function expectDialogEntersOnScreen(
  page: Page,
  contentClass: string
): Promise<void> {
  const { excursionPx, observed } = await page.evaluate(async (cls) => {
    const key = 'enter-animation-probe'
    window.app!.extensionManager.dialog.showLayoutDialog({
      key,
      component: { setup: () => () => null },
      props: {},
      dialogComponentProps: { contentClass: cls }
    })
    const startedAt = performance.now()
    let worst = 0
    let observed = false
    await new Promise<void>((resolve) => {
      const sample = () => {
        const element = document.querySelector(`[data-dialog-key="${key}"]`)
        if (element) {
          observed = true
          const { left, right } = element.getBoundingClientRect()
          worst = Math.max(worst, -left, right - window.innerWidth)
        }
        if (performance.now() - startedAt < 300) requestAnimationFrame(sample)
        else resolve()
      }
      requestAnimationFrame(sample)
    })
    return { excursionPx: worst, observed }
  }, contentClass)

  comfyExpect(observed, 'dialog was mounted during entrance sampling').toBe(
    true
  )
  comfyExpect(
    excursionPx,
    'pixels the dialog left the viewport while opening'
  ).toBeLessThanOrEqual(1)
}
