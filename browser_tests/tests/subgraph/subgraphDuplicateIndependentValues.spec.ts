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

      // Enter first subgraph, set text widget value
      await comfyPage.vueNodes.enterSubgraph(nodeId1)
      await comfyPage.vueNodes.waitForNodes()
      const textarea1 = comfyPage.vueNodes
        .getNodeByTitle(clipNodeTitle)
        .first()
        .getByRole('textbox', { name: 'text' })
      await textarea1.fill('subgraph1_value')
      await expect(textarea1).toHaveValue('subgraph1_value')
      await comfyPage.subgraph.exitViaBreadcrumb()

      // Enter second subgraph, set text widget value
      await comfyPage.vueNodes.waitForNodes()
      await comfyPage.vueNodes.enterSubgraph(nodeId2)
      await comfyPage.vueNodes.waitForNodes()
      const textarea2 = comfyPage.vueNodes
        .getNodeByTitle(clipNodeTitle)
        .first()
        .getByRole('textbox', { name: 'text' })
      await textarea2.fill('subgraph2_value')
      await expect(textarea2).toHaveValue('subgraph2_value')
      await comfyPage.subgraph.exitViaBreadcrumb()

      // Re-enter first subgraph, assert value preserved
      await comfyPage.vueNodes.waitForNodes()
      await comfyPage.vueNodes.enterSubgraph(nodeId1)
      await comfyPage.vueNodes.waitForNodes()
      const textarea1Again = comfyPage.vueNodes
        .getNodeByTitle(clipNodeTitle)
        .first()
        .getByRole('textbox', { name: 'text' })
      await expect(textarea1Again).toHaveValue('subgraph1_value')
      await comfyPage.subgraph.exitViaBreadcrumb()

      // Re-enter second subgraph, assert value preserved
      await comfyPage.vueNodes.waitForNodes()
      await comfyPage.vueNodes.enterSubgraph(nodeId2)
      await comfyPage.vueNodes.waitForNodes()
      const textarea2Again = comfyPage.vueNodes
        .getNodeByTitle(clipNodeTitle)
        .first()
        .getByRole('textbox', { name: 'text' })
      await expect(textarea2Again).toHaveValue('subgraph2_value')
    })
  }
)
