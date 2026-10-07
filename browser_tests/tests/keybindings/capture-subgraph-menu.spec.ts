import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe('Capture keyboard shortcuts', { tag: ['@canvas'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.canvasOps.resetView()
  })

  test('Escape closes a popover before a later Escape exits the subgraph', async ({
    comfyPage
  }) => {
    const subgraph = await comfyPage.nodeOps.getNodeRefById('2')
    await subgraph.navigateIntoSubgraph()
    await expect.poll(() => comfyPage.subgraph.isInSubgraph()).toBe(true)
    const options = await comfyPage.actionbar.queueButton.openOptions()
    await expect(options.menu).toBeVisible()
    await comfyPage.page.keyboard.press('Escape')
    await expect(options.menu).toBeHidden()
    await expect.poll(() => comfyPage.subgraph.isInSubgraph()).toBe(true)

    await comfyPage.keyboard.press('Escape')
    await expect.poll(() => comfyPage.subgraph.isInSubgraph()).toBe(false)
  })
})
