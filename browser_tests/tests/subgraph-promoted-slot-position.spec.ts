import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'
import { TestIds } from '../fixtures/selectors'

/**
 * Returns the widget-input slot Y position and the node title height
 * for the promoted "text" input on the SubgraphNode.
 *
 * The slot Y should be at the widget row, not the header. A value near
 * zero or negative indicates the slot is positioned at the header (the bug).
 */
async function getTextSlotPosition(page: Page, nodeId: string) {
  return page.evaluate((id) => {
    const node = window.app!.canvas.graph!.getNodeById(id)
    if (!node) return null

    const titleHeight = window.LiteGraph!['NODE_TITLE_HEIGHT'] as number
    const slotHeight = window.LiteGraph!['NODE_SLOT_HEIGHT'] as number

    for (const input of node.inputs) {
      if (!input.widget || input.type !== 'STRING') continue
      return {
        hasPos: !!input.pos,
        posY: input.pos?.[1] ?? null,
        widgetName: input.widget.name,
        titleHeight,
        slotHeight
      }
    }
    return null
  }, nodeId)
}

test.describe(
  'Subgraph promoted widget-input slot position',
  { tag: '@subgraph' },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
    })

    test('Promoted text widget slot is positioned at widget row, not header', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-promoted-text-widget'
      )

      // Render a few frames so arrange() runs
      await comfyPage.nextFrame()
      await comfyPage.nextFrame()

      const result = await getTextSlotPosition(comfyPage.page, '11')
      expect(result).not.toBeNull()
      expect(result!.hasPos).toBe(true)

      // The slot Y position should be well below the title area.
      // If it's near 0 or negative, the slot is stuck at the header (the bug).
      expect(result!.posY).toBeGreaterThan(result!.titleHeight)
    })

    test('Slot position remains correct after renaming subgraph input label', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-promoted-text-widget'
      )
      await comfyPage.nextFrame()
      await comfyPage.nextFrame()

      // Verify initial position is correct
      const before = await getTextSlotPosition(comfyPage.page, '11')
      expect(before).not.toBeNull()
      expect(before!.hasPos).toBe(true)
      expect(before!.posY).toBeGreaterThan(before!.titleHeight)

      // Navigate into subgraph and rename the text input
      const subgraphNode = await comfyPage.nodeOps.getNodeRefById('11')
      await subgraphNode.navigateIntoSubgraph()

      const initialLabel = await comfyPage.page.evaluate(() => {
        const graph = window.app!.canvas.graph
        if (!graph || !('inputNode' in graph)) return null
        const textInput = graph.inputs?.find(
          (i: { type: string }) => i.type === 'STRING'
        )
        return textInput?.label || textInput?.name || null
      })

      if (!initialLabel)
        throw new Error('Could not find STRING input in subgraph')

      await comfyPage.subgraph.rightClickInputSlot(initialLabel)
      await comfyPage.contextMenu.clickLitegraphMenuItem('Rename Slot')
      await comfyPage.nextFrame()

      const dialog = '.graphdialog input'
      await comfyPage.page.waitForSelector(dialog, { state: 'visible' })
      await comfyPage.page.fill(dialog, '')
      await comfyPage.page.fill(dialog, 'my_custom_prompt')
      await comfyPage.page.keyboard.press('Enter')
      await comfyPage.page.waitForSelector(dialog, { state: 'hidden' })

      // Navigate back to parent graph
      const breadcrumb = comfyPage.page.getByTestId(TestIds.breadcrumb.subgraph)
      await breadcrumb.waitFor({ state: 'visible', timeout: 5000 })
      await breadcrumb.getByRole('link').first().click()
      await comfyPage.nextFrame()
      await comfyPage.nextFrame()

      // Verify slot position is still at the widget row after rename
      const after = await getTextSlotPosition(comfyPage.page, '11')
      expect(after).not.toBeNull()
      expect(after!.hasPos).toBe(true)
      expect(after!.posY).toBeGreaterThan(after!.titleHeight)

      // widget.name should have been synced with the new label
      expect(after!.widgetName).toBe('my_custom_prompt')
    })
  }
)
