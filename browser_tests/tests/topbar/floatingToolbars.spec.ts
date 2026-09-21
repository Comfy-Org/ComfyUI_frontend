import type { Locator } from '@playwright/test'
import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

function panelStyle(locator: Locator) {
  return locator.evaluate((el) => {
    const style = getComputedStyle(el)
    return {
      borderRadius: style.borderRadius,
      boxShadow: style.boxShadow,
      padding: style.padding,
      borderStyle: style.borderStyle
    }
  })
}

test.describe('Floating toolbars', { tag: ['@ui', '@canvas'] }, () => {
  test.use({ initialSettings: { 'Comfy.Graph.CanvasMenu': true } })

  test('graph toggle, actionbar card and canvas menu share one panel style', async ({
    comfyPage
  }) => {
    const toggle = comfyPage.appMode.workflowActions.viewModeToggle
    const card = comfyPage.actionbar.card
    const canvasMenu = comfyPage.page.getByRole('toolbar', {
      name: 'Canvas Toolbar'
    })
    await expect(toggle).toBeVisible()
    await expect(card).toBeVisible()
    await expect(canvasMenu).toBeVisible()

    const [toggleStyle, cardStyle, canvasMenuStyle] = await Promise.all([
      panelStyle(toggle),
      panelStyle(card),
      panelStyle(canvasMenu)
    ])
    expect(toggleStyle.borderStyle).toBe('none')
    expect(cardStyle).toEqual(toggleStyle)
    expect(canvasMenuStyle).toEqual(toggleStyle)
  })

  test('graph toggle and actionbar card start at the same top edge', async ({
    comfyPage
  }) => {
    const toggle = comfyPage.appMode.workflowActions.viewModeToggle
    const card = comfyPage.actionbar.card
    await expect(toggle).toBeVisible()
    await expect(card).toBeVisible()

    const [toggleBox, cardBox] = await Promise.all([
      toggle.boundingBox(),
      card.boundingBox()
    ])
    expect(toggleBox?.y).toBe(cardBox?.y)
    expect(toggleBox?.height).toBe(cardBox?.height)
  })

  test('cancel run button is not destructive while idle', async ({
    comfyPage
  }) => {
    const cancel = comfyPage.page.getByRole('button', {
      name: 'Cancel current run'
    })
    await expect(cancel).toBeDisabled()
    await expect(cancel).not.toHaveClass(/destructive/)
  })
})
