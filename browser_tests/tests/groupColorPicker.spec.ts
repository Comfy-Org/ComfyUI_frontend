import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import { getGroupTitlePosition } from '@e2e/fixtures/utils/groupHelpers'

// LGraphCanvas.node_colors.red.groupcolor — the group-specific tint that
// LGraphGroup#setColorOption applies. Regression: the right-click Color menu
// used to assign colorOption.value.dark/light (the plain node bgcolor,
// '#533' for red) directly to group.color instead of routing through
// setColorOption, producing a visibly different shade from the toolbar
// circle-swatch picker for the same color choice.
const RED_GROUP_COLOR = '#A88'

test.describe(
  'Group Color - right-click menu matches toolbar swatch',
  { tag: ['@screenshot', '@canvas'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.Canvas.SelectionToolbox', true)
      // The right-click Color menu on a group is only routed through the
      // application menu (useGroupContextMenu) when Vue Nodes is enabled;
      // otherwise litegraph's own canvas-rendered context menu is used,
      // which nests "Color" under an "Edit Group" submenu instead of
      // exposing it as a top-level item, and never matches
      // the application context menu.
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
      await comfyPage.workflow.loadWorkflow('groups/two_groups')
    })

    test('applies the same shade as the toolbar circle-swatch picker', async ({
      comfyPage
    }) => {
      // Set color via the toolbar circle-swatch picker (SelectionToolbox).
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

      // Deselect the first group so its SelectionToolbox closes before we
      // interact with the second group — otherwise the still-visible toolbox
      // can sit over the second group's title and swallow the right-click.
      // Click a graph point clear of both groups rather than
      // canvasOps.clickEmptySpace(): that helper's position is calibrated for
      // the default graph's legacy-menu layout, and with Vue Nodes enabled
      // the canvas spans the full viewport, so the click lands on the
      // workflow tab bar instead of the canvas.
      const emptyCanvasPos = await comfyPage.page.evaluate(() =>
        window.app!.canvasPosToClientPos([1000, 500])
      )
      await comfyPage.page.mouse.click(emptyCanvasPos[0], emptyCanvasPos[1])
      await comfyPage.nextFrame()
      await expect(
        comfyPage.page.getByTestId(TestIds.selectionToolbox.root)
      ).toBeHidden()

      // Set the same color via the right-click group Color menu — the path
      // this PR fixes.
      const menuGroupPos = await getGroupTitlePosition(
        comfyPage,
        'Right-Click Menu Group'
      )
      await comfyPage.page.mouse.click(menuGroupPos.x, menuGroupPos.y, {
        button: 'right'
      })
      await expect(comfyPage.contextMenu.applicationMenu).toBeVisible()

      await comfyPage.page.getByText('Color', { exact: true }).click()
      const redSwatch = comfyPage.page.getByTitle('Red')
      await expect(redSwatch.first()).toBeVisible()
      await redSwatch.first().click()
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

      // Selecting a swatch closes the submenu popover immediately
      // (SubmenuPopover#handleSubmenuClick / NodeContextMenu#handleSubmenuSelect),
      // so the screenshot must come from a fresh open rather than the click
      // above — otherwise it captures the menu already closed and never
      // verifies the submenu's swatch rendering at all.
      await comfyPage.page.mouse.click(menuGroupPos.x, menuGroupPos.y, {
        button: 'right'
      })
      await expect(comfyPage.contextMenu.applicationMenu).toBeVisible()
      await comfyPage.page.getByText('Color', { exact: true }).click()
      await expect(redSwatch.first()).toBeVisible()

      await expect(comfyPage.canvas).toHaveScreenshot(
        'group-color-right-click-matches-toolbar-swatch.png'
      )
    })
  }
)
