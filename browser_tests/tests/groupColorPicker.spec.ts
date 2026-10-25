import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import { getGroupTitlePosition } from '@e2e/fixtures/utils/groupHelpers'
import {
  graphItems,
  screenshotRegion
} from '@e2e/fixtures/utils/screenshotRegion'

// LGraphCanvas.node_colors.red.groupcolor — the group-specific tint that
// LGraphGroup#setColorOption applies. Regression: the right-click Color menu
// used to assign colorOption.value.dark/light (the plain node bgcolor,
// '#533' for red) directly to group.color instead of routing through
// setColorOption, producing a visibly different shade from the toolbar
// circle-swatch picker for the same color choice.
const RED_GROUP_COLOR = '#A88'
const RED_NODE_COLOR = 'rgb(85, 51, 51)'

test.describe(
  'Group Color - right-click menu matches toolbar swatch',
  { tag: ['@screenshot', '@canvas', '@vue-nodes'] },
  () => {
    test.use({
      initialSettings: {
        'Comfy.Canvas.SelectionToolbox': true
      }
    })

    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('groups/two_groups')
    })

    test('applies the same shade as the toolbar circle-swatch picker', async ({
      comfyPage
    }) => {
      const toolbarGroupPos = await getGroupTitlePosition(
        comfyPage,
        'Toolbar Swatch Group'
      )
      await comfyPage.page.mouse.click(toolbarGroupPos.x, toolbarGroupPos.y)
      await comfyPage.nextFrame()

      const colorPickerButton = comfyPage.page.getByTestId(
        TestIds.selectionToolbox.colorPickerButton
      )
      await expect(colorPickerButton).toBeVisible()
      await colorPickerButton.click()

      const colorPickerGroup = comfyPage.page.getByRole('group').filter({
        has: comfyPage.page.getByTestId(TestIds.selectionToolbox.colorRed)
      })
      await colorPickerGroup
        .getByTestId(TestIds.selectionToolbox.colorRed)
        .click()
      await comfyPage.nextFrame()

      const emptyCanvasPos = await comfyPage.page.evaluate(() =>
        window.app!.canvasPosToClientPos([1000, 500])
      )
      await comfyPage.page.mouse.click(emptyCanvasPos[0], emptyCanvasPos[1])
      await comfyPage.nextFrame()
      await expect(
        comfyPage.page.getByTestId(TestIds.selectionToolbox.root)
      ).toBeHidden()

      const menuGroupPos = await getGroupTitlePosition(
        comfyPage,
        'Right-Click Menu Group'
      )
      await comfyPage.page.mouse.click(menuGroupPos.x, menuGroupPos.y, {
        button: 'right'
      })
      await expect(comfyPage.contextMenu.ariaMenu).toBeVisible()

      const colorSubmenu = await comfyPage.contextMenu.openColorSubmenu()
      const redSwatch = colorSubmenu.getByRole('menuitem', {
        name: 'Red',
        exact: true
      })
      await redSwatch.click()
      await comfyPage.nextFrame()

      const groupColors = await comfyPage.page.evaluate(() => {
        const groups = window.app!.graph.groups
        const colorOf = (title: string) =>
          groups.find((g: { title: string }) => g.title === title)?.color
        return {
          toolbarSwatch: colorOf('Toolbar Swatch Group'),
          rightClickMenu: colorOf('Right-Click Menu Group')
        }
      })

      expect(groupColors.toolbarSwatch).toBe(RED_GROUP_COLOR)
      expect(
        groupColors.rightClickMenu,
        'right-click Color menu should apply the same shade as the toolbar swatch'
      ).toBe(groupColors.toolbarSwatch)

      await comfyPage.page.mouse.click(menuGroupPos.x, menuGroupPos.y, {
        button: 'right'
      })
      await expect(comfyPage.contextMenu.ariaMenu).toBeVisible()
      await comfyPage.contextMenu.openColorSubmenu()
      await expect(comfyPage.selectionToolbox).toBeVisible()

      const region = await screenshotRegion(comfyPage.page, [
        graphItems(comfyPage.page, 'groups'),
        ...(await comfyPage.contextMenu.ariaMenu.all())
      ])
      await region.expectScreenshot(
        'group-color-right-click-matches-toolbar-swatch.png',
        { maxDiffPixels: 25 }
      )
    })

    test('refreshes the selected group toolbar swatch after menu color change', async ({
      comfyPage
    }) => {
      const groupPos = await getGroupTitlePosition(
        comfyPage,
        'Right-Click Menu Group'
      )

      await test.step('Select the group and show its toolbar', async () => {
        await comfyPage.page.mouse.click(groupPos.x, groupPos.y)
        await comfyPage.nextFrame()
        await expect(comfyPage.selectionToolbox).toBeVisible()
      })

      await test.step('Change the group color through its context menu', async () => {
        await comfyPage.page.mouse.click(groupPos.x, groupPos.y, {
          button: 'right'
        })
        await expect(comfyPage.contextMenu.ariaMenu).toBeVisible()
        const colorSubmenu = await comfyPage.contextMenu.openColorSubmenu()
        const redSwatch = colorSubmenu.getByRole('menuitem', {
          name: 'Red',
          exact: true
        })
        await redSwatch.click()
      })

      await test.step('Refresh the toolbar swatch without reselecting the group', async () => {
        await expect(comfyPage.selectionToolbox).toBeVisible()
        await expect(
          comfyPage.page.getByTestId(
            TestIds.selectionToolbox.colorPickerCurrentColor
          )
        ).toHaveCSS('color', RED_NODE_COLOR)
        await expect
          .poll(() =>
            comfyPage.page.evaluate(
              () =>
                window.app!.graph.groups.find(
                  (group) => group.title === 'Right-Click Menu Group'
                )?.color
            )
          )
          .toBe(RED_GROUP_COLOR)
      })
    })
  }
)
