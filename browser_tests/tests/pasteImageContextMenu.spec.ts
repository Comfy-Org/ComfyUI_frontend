import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe(
  'Paste Image context menu option',
  { tag: ['@node', '@vue-nodes'] },
  () => {
    test('shows Paste Image in LoadImage node context menu', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('widgets/load_image_widget')

      const loadImageNode = (
        await comfyPage.nodeOps.getNodeRefsByType('LoadImage')
      )[0]

      const nodeEl = comfyPage.page.locator(
        `[data-node-id="${loadImageNode.id}"]`
      )
      await nodeEl.click({ button: 'right' })
      const menu = comfyPage.page.locator('.p-contextmenu')
      await menu.waitFor({ state: 'visible' })
      const menuLabels = await menu
        .locator('[role="menuitem"] span.flex-1')
        .allInnerTexts()

      expect(menuLabels).toContain('Paste Image')
    })

    test('does not show Paste Image on output-only image nodes', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('nodes/single_save_image_node')

      const saveImageNode = (
        await comfyPage.nodeOps.getNodeRefsByType('SaveImage')
      )[0]

      const nodeEl = comfyPage.page.locator(
        `[data-node-id="${saveImageNode.id}"]`
      )
      await nodeEl.click({ button: 'right' })
      const menu = comfyPage.page.locator('.p-contextmenu')
      await menu.waitFor({ state: 'visible' })
      const menuLabels = await menu
        .locator('[role="menuitem"] span.flex-1')
        .allInnerTexts()

      expect(menuLabels).not.toContain('Paste Image')
      expect(menuLabels).not.toContain('Open Image')
    })
  }
)
