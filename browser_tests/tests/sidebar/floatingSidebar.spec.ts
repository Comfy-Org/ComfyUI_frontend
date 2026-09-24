import { expect, mergeTests } from '@playwright/test'

import { canvasMenuFixture } from '@e2e/fixtures/canvasMenuFixture'
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import { readPanelStyle } from '@e2e/fixtures/utils/panelStyle'

const test = mergeTests(comfyPageFixture, canvasMenuFixture)

for (const location of ['left', 'right'] as const) {
  const locationSettings = {
    'Comfy.Graph.CanvasMenu': true,
    'Comfy.Sidebar.Location': location,
    'Comfy.Sidebar.Size': 'small'
  }

  test.describe(`${location} floating sidebar`, { tag: ['@ui'] }, () => {
    test.use({ initialSettings: locationSettings })

    test('keeps the connected gap to the top menu when switched to floating', async ({
      comfyPage
    }) => {
      const toolbar = comfyPage.menu.sideToolbar
      const neighbor =
        location === 'left'
          ? comfyPage.appMode.workflowActions.viewModeToggle
          : comfyPage.actionbar.card
      const gapToTopMenu = async () => {
        const [toolbarBox, neighborBox] = await Promise.all([
          toolbar.boundingBox(),
          neighbor.boundingBox()
        ])
        if (!toolbarBox || !neighborBox) return null
        return location === 'left'
          ? neighborBox.x - (toolbarBox.x + toolbarBox.width)
          : toolbarBox.x - (neighborBox.x + neighborBox.width)
      }

      await expect(toolbar).toContainClass('connected-sidebar')
      await expect(neighbor).toBeVisible()
      const connectedGap = await gapToTopMenu()
      expect(connectedGap).toBeGreaterThan(0)

      await comfyPage.settings.setSetting('Comfy.Sidebar.Style', 'floating')
      await expect(toolbar).toContainClass('floating-sidebar')
      await expect.poll(gapToTopMenu).toBe(connectedGap)
    })

    test.describe('floating', () => {
      test.use({
        initialSettings: {
          ...locationSettings,
          'Comfy.Sidebar.Style': 'floating'
        }
      })

      test('sits one canvas gutter from the window edge and on the top menu edge', async ({
        comfyPage,
        canvasMenu
      }) => {
        const group = comfyPage.menu.sideToolbar.getByTestId(
          TestIds.sidebar.topGroup
        )
        const toggle = comfyPage.appMode.workflowActions.viewModeToggle

        await expect(async () => {
          const [groupBox, toggleBox, menuBox] = await Promise.all([
            group.boundingBox(),
            toggle.boundingBox(),
            canvasMenu.root.boundingBox()
          ])
          const viewport = comfyPage.page.viewportSize()
          if (!groupBox || !toggleBox || !menuBox || !viewport) {
            throw new Error('Layout not ready')
          }
          const edgeGap =
            location === 'left'
              ? groupBox.x
              : viewport.width - (groupBox.x + groupBox.width)
          const canvasMenuGap = viewport.height - (menuBox.y + menuBox.height)
          expect(canvasMenuGap).toBeGreaterThan(0)
          expect(edgeGap).toBe(canvasMenuGap)
          expect(groupBox.y).toBe(toggleBox.y)
        }).toPass({ timeout: 5000 })
      })
    })
  })
}

test.describe('floating sidebar panel style', { tag: ['@ui'] }, () => {
  test.use({
    initialSettings: {
      'Comfy.Sidebar.Size': 'small',
      'Comfy.Sidebar.Style': 'floating'
    }
  })

  test('shares the floating panel style of the view mode toggle', async ({
    comfyPage
  }) => {
    const group = comfyPage.menu.sideToolbar.getByTestId(
      TestIds.sidebar.topGroup
    )
    const toggle = comfyPage.appMode.workflowActions.viewModeToggle
    await expect(group).toBeVisible()
    await expect(toggle).toBeVisible()

    const [groupStyle, toggleStyle] = await Promise.all([
      readPanelStyle(group),
      readPanelStyle(toggle)
    ])
    expect(groupStyle).toEqual(toggleStyle)
  })
})
