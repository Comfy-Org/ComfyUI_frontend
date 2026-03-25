import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '../../../../fixtures/ComfyPage'
import { TestIds } from '../../../../fixtures/selectors'

test.describe(
  'FormDropdown positioning in Vue nodes',
  { tag: ['@widget', '@node'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
      await comfyPage.workflow.loadWorkflow('widgets/load_image_widget')
      await comfyPage.vueNodes.waitForNodes()
    })

    test('dropdown menu appears directly below the trigger', async ({
      comfyPage
    }) => {
      const node = comfyPage.vueNodes.getNodeByTitle('Load Image')
      await expect(node).toBeVisible()

      const trigger = node.getByTestId(TestIds.widgets.formDropdownTrigger)
      await trigger.first().click()

      const menu = comfyPage.page.getByTestId(TestIds.widgets.formDropdownMenu)
      await expect(menu).toBeVisible({ timeout: 5000 })

      const triggerBox = await trigger.first().boundingBox()
      const menuBox = await menu.boundingBox()

      expect(triggerBox).toBeTruthy()
      expect(menuBox).toBeTruthy()

      // Menu top should be near the trigger bottom (within 20px tolerance for padding)
      expect(menuBox!.y).toBeGreaterThanOrEqual(
        triggerBox!.y + triggerBox!.height - 5
      )
      expect(menuBox!.y).toBeLessThanOrEqual(
        triggerBox!.y + triggerBox!.height + 20
      )

      // Menu left should be near the trigger left (within 10px tolerance)
      expect(menuBox!.x).toBeGreaterThanOrEqual(triggerBox!.x - 10)
      expect(menuBox!.x).toBeLessThanOrEqual(triggerBox!.x + 10)
    })

    test('dropdown menu appears correctly at different zoom levels', async ({
      comfyPage
    }) => {
      for (const zoom of [0.75, 1.5]) {
        // Set zoom via canvas
        await comfyPage.page.evaluate((scale) => {
          const canvas = window.app!.canvas
          canvas.ds.scale = scale
          canvas.setDirty(true, true)
        }, zoom)
        await comfyPage.nextFrame()

        const node = comfyPage.vueNodes.getNodeByTitle('Load Image')
        await expect(node).toBeVisible()

        const trigger = node.getByTestId(TestIds.widgets.formDropdownTrigger)
        await trigger.first().click()

        const menu = comfyPage.page.getByTestId(
          TestIds.widgets.formDropdownMenu
        )
        await expect(menu).toBeVisible({ timeout: 5000 })

        const triggerBox = await trigger.first().boundingBox()
        const menuBox = await menu.boundingBox()

        expect(triggerBox).toBeTruthy()
        expect(menuBox).toBeTruthy()

        // Menu top should still be near trigger bottom regardless of zoom
        expect(menuBox!.y).toBeGreaterThanOrEqual(
          triggerBox!.y + triggerBox!.height - 5
        )
        expect(menuBox!.y).toBeLessThanOrEqual(
          triggerBox!.y + triggerBox!.height + 20 * zoom
        )

        // Close dropdown before next iteration
        await comfyPage.page.keyboard.press('Escape')
        await expect(menu).not.toBeVisible()
      }
    })

    test('dropdown closes on outside click', async ({ comfyPage }) => {
      const node = comfyPage.vueNodes.getNodeByTitle('Load Image')
      const trigger = node.getByTestId(TestIds.widgets.formDropdownTrigger)
      await trigger.first().click()

      const menu = comfyPage.page.getByTestId(TestIds.widgets.formDropdownMenu)
      await expect(menu).toBeVisible({ timeout: 5000 })

      // Click outside the node
      await comfyPage.page.mouse.click(10, 10)
      await expect(menu).not.toBeVisible()
    })

    test('dropdown closes on Escape key', async ({ comfyPage }) => {
      const node = comfyPage.vueNodes.getNodeByTitle('Load Image')
      const trigger = node.getByTestId(TestIds.widgets.formDropdownTrigger)
      await trigger.first().click()

      const menu = comfyPage.page.getByTestId(TestIds.widgets.formDropdownMenu)
      await expect(menu).toBeVisible({ timeout: 5000 })

      await comfyPage.page.keyboard.press('Escape')
      await expect(menu).not.toBeVisible()
    })
  }
)
