import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

// A viewport spot on the empty canvas, clear of the side toolbar.
const ADD_POSITION = { x: 200, y: 200 }

// The Agent is not involved here: the local build has no follower, so this
// is the baseline the Agent-bound spec in tests/agent is measured against.
test.describe('Workflow tab switch keeps nodes added on the canvas', () => {
  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.canvasOps.resetView()
  })

  for (const { name, query } of [
    { name: 'a node added the ordinary way', query: 'KSampler' },
    { name: 'a frontend-only node', query: 'Note' },
    { name: 'a subgraph blueprint', query: 'test blueprint' }
  ]) {
    test(`keeps ${name} after switching to another tab and back`, async ({
      comfyPage
    }) => {
      const nodeId =
        await test.step('set up a blank workflow and add the node', async () => {
          // A blank tab, so the double-click that opens the search box lands
          // on the canvas and not on a default-graph node.
          await comfyPage.workflow.newBlankWorkflow()
          const addedNodeId = await comfyPage.searchBoxV2.addNodeAndGetId(
            query,
            { position: ADD_POSITION }
          )
          await comfyPage.attachScreenshot(`${query}-before-tab-switch.png`, {
            runInCI: true
          })
          return addedNodeId
        })

      await test.step('switch to another tab and back', async () => {
        await comfyPage.workflow.openNewTabThenReturn()
        await comfyPage.attachScreenshot(`${query}-after-tab-switch.png`, {
          runInCI: true
        })
        await expect
          .poll(() => comfyPage.workflow.getGraphNodeIds())
          .toContain(nodeId)
      })
    })
  }
})
