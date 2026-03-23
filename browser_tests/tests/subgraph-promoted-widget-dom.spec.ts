import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'
import { getPromotedWidgetNames } from '../helpers/promotedWidgets'

const DIALOG_SELECTOR = '.graphdialog input'
const RENAMED_LABEL = 'my_seed'

test.describe(
  'Subgraph promoted widget DOM position after rename',
  { tag: '@subgraph' },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
    })

    test('Promoted seed widget stays in node body after label rename', async ({
      comfyPage
    }) => {
      const { page } = comfyPage
      await comfyPage.workflow.loadWorkflow('default')

      // Convert KSampler (id 3) to subgraph — seed is auto-promoted.
      // Vue nodes must be disabled here because convertToSubgraph uses the
      // litegraph context menu which is intercepted by Vue node overlays.
      const ksampler = await comfyPage.nodeOps.getNodeRefById('3')
      await ksampler.click('title')
      const subgraphNode = await ksampler.convertToSubgraph()
      await comfyPage.nextFrame()

      // Enable Vue nodes now that the subgraph has been created
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)

      const subgraphNodeId = String(subgraphNode.id)
      const promotedNames = await getPromotedWidgetNames(
        comfyPage,
        subgraphNodeId
      )
      expect(promotedNames).toContain('seed')

      // Wait for Vue nodes to render
      await comfyPage.vueNodes.waitForNodes()

      const nodeLocator = comfyPage.vueNodes.getNodeLocator(subgraphNodeId)
      await expect(nodeLocator).toBeVisible()

      // The seed widget should be visible inside the node body
      const seedWidget = nodeLocator.getByLabel('seed', { exact: true }).first()
      await expect(seedWidget).toBeVisible()

      // Verify widget is inside the node body, not the header
      const headerBox = await nodeLocator
        .locator('[data-testid^="node-header-"]')
        .boundingBox()
      const widgetBox = await seedWidget.boundingBox()
      expect(headerBox).not.toBeNull()
      expect(widgetBox).not.toBeNull()

      // Widget top should be below the header bottom
      expect(widgetBox!.y).toBeGreaterThan(headerBox!.y + headerBox!.height)

      // --- Rename the seed input label inside the subgraph ---
      await comfyPage.vueNodes.enterSubgraph(subgraphNodeId)
      await comfyPage.nextFrame()

      // Find the seed input slot label from the subgraph's inputNode slots
      const seedSlotLabel = await page.evaluate(() => {
        const graph = window.app!.canvas.graph
        if (!graph || !('inputNode' in graph)) return null
        const inputNode = (
          graph as {
            inputNode: {
              slots: Array<{
                name: string
                label?: string
                widget?: { name: string }
              }>
            }
          }
        ).inputNode
        const seedSlot = inputNode.slots.find(
          (s) => s.name === 'seed' || s.widget?.name === 'seed'
        )
        return seedSlot?.label || seedSlot?.name || null
      })
      expect(seedSlotLabel).not.toBeNull()

      // Right-click the seed slot and rename
      await comfyPage.subgraph.rightClickInputSlot(seedSlotLabel!)
      await comfyPage.contextMenu.clickLitegraphMenuItem('Rename Slot')
      await comfyPage.nextFrame()

      await page.waitForSelector(DIALOG_SELECTOR, { state: 'visible' })
      await page.fill(DIALOG_SELECTOR, '')
      await page.fill(DIALOG_SELECTOR, RENAMED_LABEL)
      await page.keyboard.press('Enter')
      await page.waitForSelector(DIALOG_SELECTOR, { state: 'hidden' })

      // Navigate back to parent graph
      await comfyPage.subgraph.exitViaBreadcrumb()
      await comfyPage.vueNodes.waitForNodes()

      // The subgraph node should still be visible
      const nodeAfter = comfyPage.vueNodes.getNodeLocator(subgraphNodeId)
      await expect(nodeAfter).toBeVisible()

      // The widget should now display the renamed label text.
      // WidgetLayoutField renders `widget.label || widget.name`, so the
      // visible text changes to RENAMED_LABEL after the rename.
      const renamedText = nodeAfter.getByText(RENAMED_LABEL)
      await expect(renamedText).toBeVisible()

      // The widget input (aria-label stays "seed" — the internal name)
      // should still be visible and inside the body, not the header.
      const seedWidgetAfter = nodeAfter
        .getByLabel('seed', { exact: true })
        .first()
      await expect(seedWidgetAfter).toBeVisible()

      const headerBoxAfter = await nodeAfter
        .locator('[data-testid^="node-header-"]')
        .boundingBox()
      const widgetBoxAfter = await seedWidgetAfter.boundingBox()
      expect(headerBoxAfter).not.toBeNull()
      expect(widgetBoxAfter).not.toBeNull()

      // The bug caused the widget to jump to y=0 relative to the node
      // (i.e. inside the header area). After the fix, it remains in the body.
      expect(widgetBoxAfter!.y).toBeGreaterThan(
        headerBoxAfter!.y + headerBoxAfter!.height
      )
    })
  }
)
