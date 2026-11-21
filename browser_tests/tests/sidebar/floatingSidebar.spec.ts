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

    test('keeps the top menu in place when switched to floating', async ({
      comfyPage
    }) => {
      const toolbar = comfyPage.menu.sideToolbar
      const neighbor =
        location === 'left'
          ? comfyPage.appMode.workflowActions.viewModeToggle
          : comfyPage.actionbar.card
      const viewport = comfyPage.page.viewportSize()
      if (!viewport) throw new Error('Viewport size is not set')
      const readLayout = async () => {
        const [toolbarBox, neighborBox] = await Promise.all([
          toolbar.boundingBox(),
          neighbor.boundingBox()
        ])
        if (!toolbarBox || !neighborBox) return null
        return {
          toolbar: toolbarBox,
          neighbor: neighborBox,
          toolbarInnerEdge:
            location === 'left' ? toolbarBox.x + toolbarBox.width : toolbarBox.x
        }
      }

      await expect(toolbar).toContainClass('connected-sidebar')
      await expect(toolbar).toHaveCSS('overflow', 'hidden')
      await expect(neighbor).toBeVisible()
      const connected = await readLayout()
      if (!connected) throw new Error('Connected layout not ready')
      expect(connected.toolbar).toMatchObject({
        x: location === 'left' ? 0 : viewport.width - 56,
        width: 56
      })

      await comfyPage.settings.setSetting('Comfy.Sidebar.Style', 'floating')
      await expect(toolbar).toContainClass('floating-sidebar')
      await expect(toolbar).toHaveCSS('overflow', 'visible')
      await expect
        .poll(async () => {
          const floating = await readLayout()
          if (!floating) return null
          return {
            neighbor: floating.neighbor,
            toolbarInnerEdge: floating.toolbarInnerEdge
          }
        })
        .toEqual({
          neighbor: connected.neighbor,
          toolbarInnerEdge: connected.toolbarInnerEdge
        })
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

  test('shares the floating panel style of the view mode toggle, full bleed', async ({
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
    expect(groupStyle).toEqual({ ...toggleStyle, padding: '0px' })
  })
})
