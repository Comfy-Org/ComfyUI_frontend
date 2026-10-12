import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { GraphCanvasMenu } from '@e2e/fixtures/components/GraphCanvasMenu'
import { Tooltip } from '@e2e/fixtures/components/Tooltip'

test.describe('Design-system tooltip', { tag: '@canvas' }, () => {
  test.use({ initialSettings: { 'Comfy.Graph.CanvasMenu': true } })

  test('opens on hover without repeating the button name as a description, and closes when the pointer leaves', async ({
    comfyPage
  }) => {
    const menu = new GraphCanvasMenu(comfyPage.page)
    const tooltip = new Tooltip(comfyPage.page).named(/^Fit View/)

    await menu.fitViewButton.hover()

    await expect(tooltip).toBeVisible()
    await expect(menu.fitViewButton).toHaveAccessibleDescription('')

    await comfyPage.canvasOps.moveMouseToEmptyArea()
    await expect(tooltip).toBeHidden()
  })

  test('portals its content outside the trigger subtree', async ({
    comfyPage
  }) => {
    const menu = new GraphCanvasMenu(comfyPage.page)
    const tooltip = new Tooltip(comfyPage.page).named(/^Fit View/)

    await menu.fitViewButton.hover()

    await expect(tooltip).toBeVisible()
    await expect(menu.root.getByRole('tooltip')).toHaveCount(0)
  })

  test('opens from keyboard focus and closes with Escape', async ({
    comfyPage
  }) => {
    const menu = new GraphCanvasMenu(comfyPage.page)
    const tooltip = new Tooltip(comfyPage.page).named(/Minimap/)

    await test.step('keyboard focus opens the tooltip', async () => {
      await menu.zoomControlsButton.focus()
      await comfyPage.page.keyboard.press('Tab')

      await expect(menu.minimapButton).toBeFocused()
      await expect(tooltip).toBeVisible()
    })

    await test.step('Escape closes it and keeps focus', async () => {
      await comfyPage.page.keyboard.press('Escape')
      await expect(tooltip).toBeHidden()
      await expect(menu.minimapButton).toBeFocused()
    })
  })

  test('shares one app-level provider, so a neighbouring tooltip skips the open delay', async ({
    comfyPage
  }) => {
    const menu = new GraphCanvasMenu(comfyPage.page)
    const tooltips = new Tooltip(comfyPage.page)

    await menu.fitViewButton.hover()
    await expect(tooltips.surface(tooltips.named(/^Fit View/))).toHaveAttribute(
      'data-state',
      'delayed-open'
    )

    await menu.zoomControlsButton.hover()
    await expect(
      tooltips.surface(tooltips.named('Zoom Controls'))
    ).toHaveAttribute('data-state', 'instant-open')
    await expect(tooltips.open).toHaveCount(1)
  })
})
