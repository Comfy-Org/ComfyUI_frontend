import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'

async function openVueNodeContextMenu(comfyPage: ComfyPage, nodeTitle: string) {
  const fixture = await comfyPage.vueNodes.getFixtureByTitle(nodeTitle)
  await comfyPage.contextMenu.openForVueNode(fixture.header)
}

test.describe(
  'Subgraph Duplicate Independent Values',
  { tag: ['@slow', '@subgraph', '@vue-nodes'] },
  () => {
    test('Duplicated subgraphs maintain independent widget values', async ({
      comfyPage
    }) => {
      const clipNodeTitle = 'CLIP Text Encode (Prompt)'

      // Convert first CLIP Text Encode node to subgraph
      await openVueNodeContextMenu(comfyPage, clipNodeTitle)
      await comfyPage.contextMenu.clickMenuItemExact('Convert to Subgraph')
      await comfyPage.contextMenu.waitForHidden()
      const subgraphNode = comfyPage.vueNodes.getNodeByTitle('New Subgraph')
      await expect(subgraphNode).toBeVisible()

      // Duplicate the subgraph
      await openVueNodeContextMenu(comfyPage, 'New Subgraph')
      await comfyPage.contextMenu.clickMenuItemExact('Duplicate')
      await comfyPage.contextMenu.waitForHidden()

      // Capture both subgraph node IDs
      const subgraphNodes = comfyPage.vueNodes.getNodeByTitle('New Subgraph')
      await expect(subgraphNodes).toHaveCount(2)
      const nodeIds = await subgraphNodes.evaluateAll((nodes) =>
        nodes
          .map((n) => n.getAttribute('data-node-id'))
          .filter((id): id is string => id !== null)
      )
      const [nodeId1, nodeId2] = nodeIds

      const promotedTextarea = (nodeId: string) =>
        comfyPage.vueNodes
          .getNodeLocator(nodeId)
          .getByRole('textbox', { name: 'text' })

      await promotedTextarea(nodeId1).fill('subgraph1_value')
      await expect(promotedTextarea(nodeId1)).toHaveValue('subgraph1_value')

      await promotedTextarea(nodeId2).fill('subgraph2_value')
      await expect(promotedTextarea(nodeId2)).toHaveValue('subgraph2_value')

      await expect(promotedTextarea(nodeId1)).toHaveValue('subgraph1_value')
      await expect(promotedTextarea(nodeId2)).toHaveValue('subgraph2_value')
    })
  }
)

for (const renderer of [
  { name: 'LiteGraph', tag: ['@slow', '@subgraph', '@ui'] },
  { name: 'Vue', tag: ['@slow', '@subgraph', '@ui', '@vue-nodes'] }
]) {
  test.describe(`${renderer.name} renderer`, { tag: renderer.tag }, () => {
    test('editing a copied host does not change the original', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-promoted-text-widget'
      )
      const original = await comfyPage.nodeOps.getNodeRefById('11')

      await test.step('Edit the original host', async () => {
        await original.fillPromotedTextWidget('text', 'original parent edit')
      })

      const copy = await test.step('Copy the host', () => original.duplicate())

      await test.step('Edit only the copy', async () => {
        await copy.fillPromotedTextWidget('text', 'copy-only edit')
        await original.expectPromotedTextWidgetValue(
          'text',
          'original parent edit'
        )
      })

      await test.step('Edit the original without changing the copy', async () => {
        await original.fillPromotedTextWidget('text', 'original second edit')
        await copy.expectPromotedTextWidgetValue('text', 'copy-only edit')
      })

      await test.step('Delete the copy and continue editing the original', async () => {
        await copy.delete()
        await copy.expectExists(false)
        await original.expectPromotedTextWidgetValue(
          'text',
          'original second edit'
        )
        await original.fillPromotedTextWidget(
          'text',
          'original survives duplicate deletion'
        )
      })
    })
  })
}
