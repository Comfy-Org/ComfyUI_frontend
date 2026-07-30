import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

/**
 * FE-853: a subgraph node the user has manually resized snaps back to its
 * computed minimum size as soon as the widget-editing UI is triggered — either
 * by the "Edit Subgraph Widgets" selection-toolbox button or by promoting a
 * widget from inside the subgraph — discarding the size the user set.
 *
 * https://linear.app/comfyorg/issue/FE-853
 */
test.describe(
  'Subgraph node size across widget editing',
  { tag: ['@subgraph', '@node', '@widget', '@vue-nodes'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.Canvas.SelectionToolbox', true)
      await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')
    })

    test('retains a manual resize when Edit Subgraph Widgets is clicked', async ({
      comfyPage
    }) => {
      const { nodeRef, node, size } = await comfyPage.nodeOps.growNodeByDrag(
        'New Subgraph',
        { x: 250, y: 250 }
      )

      await comfyPage.subgraph.editor.openFromSelectionToolbox(node.root)
      await comfyPage.nextFrame()

      const sizeAfter = await nodeRef.getSize()
      expect(sizeAfter.width).toBeCloseTo(size.width, 0)
      expect(sizeAfter.height).toBeCloseTo(size.height, 0)
    })

    test('retains a manual resize when an interior widget is promoted', async ({
      comfyPage
    }) => {
      const { nodeRef, size } = await comfyPage.nodeOps.growNodeByDrag(
        'New Subgraph',
        { x: 250, y: 250 }
      )

      await comfyPage.vueNodes.enterSubgraph(String(nodeRef.id))
      await comfyPage.subgraph.promoteWidget(
        comfyPage.vueNodes.getNodeByTitle('KSampler'),
        'steps'
      )
      await comfyPage.subgraph.exitViaBreadcrumb()

      const sizeAfter = await nodeRef.getSize()
      expect(sizeAfter.width).toBeCloseTo(size.width, 0)
      // A newly promoted widget can legitimately raise the minimum height, so
      // only a shrink below the user's size is a regression.
      expect(sizeAfter.height).toBeGreaterThanOrEqual(size.height)
    })
  }
)
