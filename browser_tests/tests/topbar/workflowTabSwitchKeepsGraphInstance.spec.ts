import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe('Workflow tab switch keeps the graph instance', () => {
  test('keeps the same node objects after switching to another tab and back', async ({
    comfyPage
  }) => {
    const rootGraphId = await comfyPage.subgraph.getRootGraphId()
    const nodeIds = await comfyPage.workflow.getGraphNodeIds()
    const firstNode = await comfyPage.page.evaluateHandle(
      () => window.app!.rootGraph.nodes[0]
    )

    await comfyPage.workflow.openNewTabThenReturn()

    await expect
      .poll(() => comfyPage.subgraph.getRootGraphId())
      .toBe(rootGraphId)
    await expect
      .poll(() => comfyPage.workflow.getGraphNodeIds())
      .toEqual(nodeIds)
    expect(
      await comfyPage.page.evaluate(
        (node) => window.app!.rootGraph.getNodeById(node.id) === node,
        firstNode
      )
    ).toBe(true)
  })

  test('gives a tab loaded from the same serialized root id its own live graph', async ({
    comfyPage
  }) => {
    const { topbar } = comfyPage.menu
    const serialized = await comfyPage.workflow.getExportedWorkflow()
    const originalRootGraphId = await comfyPage.subgraph.getRootGraphId()
    const originalNodeIds = await comfyPage.workflow.getGraphNodeIds()
    expect(serialized.id).toBe(originalRootGraphId)

    await comfyPage.workflow.loadGraphData(serialized)
    await comfyPage.workflow.waitForWorkflowIdle()
    await expect(topbar.tabs).toHaveCount(2)
    await expect(topbar.getTab(1).and(topbar.getActiveTab())).toBeVisible()

    const copyRootGraphId = await comfyPage.subgraph.getRootGraphId()
    expect(copyRootGraphId).not.toBe(originalRootGraphId)
    const addedNode = await comfyPage.nodeOps.addNode('Note', undefined, {
      x: 1200,
      y: 900
    })
    const addedNodeId = String(addedNode.id)

    await topbar.getTab(0).click()
    await comfyPage.workflow.waitForWorkflowIdle()
    await expect
      .poll(() => comfyPage.subgraph.getRootGraphId())
      .toBe(originalRootGraphId)
    await expect
      .poll(() => comfyPage.workflow.getGraphNodeIds())
      .toEqual(originalNodeIds)

    await topbar.getTab(1).click()
    await comfyPage.workflow.waitForWorkflowIdle()
    await expect
      .poll(() => comfyPage.subgraph.getRootGraphId())
      .toBe(copyRootGraphId)
    await expect
      .poll(() => comfyPage.workflow.getGraphNodeIds())
      .toContain(addedNodeId)
  })
})
