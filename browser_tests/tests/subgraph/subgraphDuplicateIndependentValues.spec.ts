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
    for (const scenario of [
      { survivorName: 'copy', removedName: 'original' },
      { survivorName: 'original', removedName: 'copy' }
    ] as const) {
      test(`the ${scenario.survivorName} keeps its independent value after deleting the ${scenario.removedName} and reopening`, async ({
        comfyPage
      }) => {
        test.slow()
        await comfyPage.workflow.setupWorkflowsDirectory({})
        await comfyPage.workflow.loadWorkflow(
          'subgraphs/subgraph-with-promoted-text-widget'
        )
        const original = await comfyPage.nodeOps.getNodeRefById('11')
        const copy = await original.duplicate()
        const survivor = scenario.survivorName === 'copy' ? copy : original
        const removed = scenario.removedName === 'copy' ? copy : original
        const survivorValue = `${scenario.survivorName} durable value`
        const removedValue = `${scenario.removedName} discarded value`

        await test.step('Set independent host values', async () => {
          await survivor.fillPromotedTextWidget('text', survivorValue)
          await removed.fillPromotedTextWidget('text', removedValue)
          await survivor.expectPromotedTextWidgetValue('text', survivorValue)
          await removed.expectPromotedTextWidgetValue('text', removedValue)
        })

        await test.step(`Delete the ${scenario.removedName}`, async () => {
          await removed.delete()
          await removed.expectExists(false)
          await survivor.expectPromotedTextWidgetValue('text', survivorValue)
        })

        const workflowName = `${renderer.name.toLowerCase()}-${scenario.survivorName}-host-value`

        await test.step('Save, reload, and reopen the workflow', async () => {
          await comfyPage.workflow.saveWorkflow(workflowName)
          await comfyPage.workflow.reloadAndOpenPersistedWorkflow(workflowName)
        })

        await test.step('Verify and edit the surviving host value', async () => {
          const restored = await comfyPage.nodeOps.getNodeRefById(
            String(survivor.id)
          )
          await restored.expectPromotedTextWidgetValue('text', survivorValue)
          await restored.fillPromotedTextWidget(
            'text',
            `${survivorValue} edited after reopen`
          )
          await restored.expectPromotedTextWidgetValue(
            'text',
            `${survivorValue} edited after reopen`
          )
        })
      })
    }
  })
}
