import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '../fixtures/ComfyPage'

const WORKFLOW = 'subgraphs/test-values-input-subgraph'
const RENAMED_LABEL = 'my_seed'

/**
 * Regression test for subgraph input slot rename propagation.
 *
 * Renaming a SubgraphInput slot (e.g. "seed") inside the subgraph must
 * update the promoted widget label shown on the parent SubgraphNode and
 * keep the widget positioned in the node body (not the header).
 *
 * See: https://github.com/Comfy-Org/ComfyUI_frontend/pull/10195
 */
test.describe(
  'Subgraph input slot rename propagation',
  { tag: ['@subgraph', '@widget'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    })

    test('Renaming a subgraph input slot updates the widget label on the parent node', async ({
      comfyPage
    }) => {
      const { page } = comfyPage

      // 1. Load workflow with subgraph containing a promoted seed widget input
      await comfyPage.workflow.loadWorkflow(WORKFLOW)
      await comfyPage.vueNodes.waitForNodes()

      const sgNode = comfyPage.vueNodes.getNodeLocator('19')
      await expect(sgNode).toBeVisible()

      // 2. Verify the seed widget is visible on the parent node
      const seedWidget = sgNode.getByLabel('seed', { exact: true })
      await expect(seedWidget).toBeVisible()

      // Verify widget is in the node body, not the header
      const headerBox = await sgNode
        .locator('[data-testid^="node-header-"]')
        .boundingBox()
      const widgetBox = await seedWidget.boundingBox()
      expect(headerBox).not.toBeNull()
      expect(widgetBox).not.toBeNull()
      expect(widgetBox!.y).toBeGreaterThan(headerBox!.y + headerBox!.height)

      // 3. Enter the subgraph and rename the seed slot.
      //    The subgraph IO rename uses canvas.prompt() which requires the
      //    litegraph context menu, so temporarily disable Vue nodes.
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', false)
      await comfyPage.nextFrame()

      const sgNodeRef = await comfyPage.nodeOps.getNodeRefById('19')
      await sgNodeRef.navigateIntoSubgraph()

      // Find the seed SubgraphInput slot
      const seedSlotName = await page.evaluate(() => {
        const graph = window.app!.canvas.graph
        if (!graph) return null
        const inputs = (
          graph as { inputs?: Array<{ name: string; type: string }> }
        ).inputs
        return inputs?.find((i) => i.name.includes('seed'))?.name ?? null
      })
      expect(seedSlotName).not.toBeNull()

      // 4. Right-click the seed input slot and rename it
      await comfyPage.subgraph.rightClickInputSlot(seedSlotName!)
      await comfyPage.contextMenu.clickLitegraphMenuItem('Rename Slot')
      await comfyPage.nextFrame()

      const dialog = '.graphdialog input'
      await page.waitForSelector(dialog, { state: 'visible' })
      await page.fill(dialog, '')
      await page.fill(dialog, RENAMED_LABEL)
      await page.keyboard.press('Enter')
      await page.waitForSelector(dialog, { state: 'hidden' })

      // 5. Navigate back to parent graph and re-enable Vue nodes
      await comfyPage.subgraph.exitViaBreadcrumb()
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
      await comfyPage.vueNodes.waitForNodes()

      // 6. Verify the widget label updated to the renamed value
      const sgNodeAfter = comfyPage.vueNodes.getNodeLocator('19')
      await expect(sgNodeAfter).toBeVisible()

      const updatedLabel = await page.evaluate(() => {
        const node = window.app!.canvas.graph!.getNodeById('19')
        if (!node) return null
        const w = node.widgets?.find((w: { name: string }) =>
          w.name.includes('seed')
        )
        return w?.label || w?.name || null
      })
      expect(updatedLabel).toBe(RENAMED_LABEL)

      // 7. Verify the widget is still in the body, not the header
      const seedWidgetAfter = sgNodeAfter.getByLabel('seed', { exact: true })
      await expect(seedWidgetAfter).toBeVisible()

      const headerAfter = await sgNodeAfter
        .locator('[data-testid^="node-header-"]')
        .boundingBox()
      const widgetAfter = await seedWidgetAfter.boundingBox()
      expect(headerAfter).not.toBeNull()
      expect(widgetAfter).not.toBeNull()
      expect(widgetAfter!.y).toBeGreaterThan(
        headerAfter!.y + headerAfter!.height
      )
    })
  }
)
