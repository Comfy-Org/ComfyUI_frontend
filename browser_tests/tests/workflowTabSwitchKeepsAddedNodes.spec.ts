import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'

// A viewport spot on the empty canvas, clear of the side toolbar.
const ADD_POSITION = { x: 200, y: 200 }

function graphNodeIds(comfyPage: ComfyPage): Promise<string[]> {
  return comfyPage.page.evaluate(() =>
    window.app!.graph.nodes.map((node) => String(node.id))
  )
}

// A blank workflow tab, so the double-click that opens the search box lands
// on the canvas and not on a default-graph node.
async function openBlankWorkflow(comfyPage: ComfyPage): Promise<void> {
  await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
  await expect.poll(() => graphNodeIds(comfyPage)).toEqual([])
}

// Adds through the search box and returns the id the graph gave the node.
async function addThroughSearchBox(
  comfyPage: ComfyPage,
  query: string
): Promise<string> {
  const before = new Set(await graphNodeIds(comfyPage))
  await comfyPage.searchBoxV2.addNode(query, { position: ADD_POSITION })
  await expect
    .poll(async () =>
      (await graphNodeIds(comfyPage)).filter((id) => !before.has(id))
    )
    .toHaveLength(1)
  const [added] = (await graphNodeIds(comfyPage)).filter(
    (id) => !before.has(id)
  )
  return added
}

// The active tab is the last one (a new workflow opens at the end of the
// bar); a further new tab takes focus, then the click brings the first back.
async function switchToNewTabAndBack(comfyPage: ComfyPage): Promise<void> {
  const topbar = comfyPage.menu.topbar
  const tabs = (await topbar.getTabNames()).length
  await expect(topbar.getTab(tabs - 1)).toHaveClass(/p-togglebutton-checked/)
  await topbar.newWorkflowButton.click()
  await expect.poll(() => topbar.getTabNames()).toHaveLength(tabs + 1)
  await expect.poll(() => graphNodeIds(comfyPage)).toEqual([])
  await topbar.getTab(tabs - 1).click()
  await expect(topbar.getTab(tabs - 1)).toHaveClass(/p-togglebutton-checked/)
  await comfyPage.workflow.waitForWorkflowIdle()
}

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
      await openBlankWorkflow(comfyPage)
      const nodeId = await addThroughSearchBox(comfyPage, query)
      await comfyPage.attachScreenshot(`${query}-before-tab-switch.png`, {
        runInCI: true
      })

      await switchToNewTabAndBack(comfyPage)

      await comfyPage.attachScreenshot(`${query}-after-tab-switch.png`, {
        runInCI: true
      })
      await expect.poll(() => graphNodeIds(comfyPage)).toContain(nodeId)
    })
  }
})
