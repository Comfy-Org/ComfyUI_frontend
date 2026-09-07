import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe('Vue Node registration', { tag: '@vue-nodes' }, () => {
  test('renders both nodes when a workflow reuses a node id', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('nodes/duplicate_node_ids')
    await comfyPage.vueNodes.waitForNodes(2)

    const ids = await comfyPage.vueNodes.getNodeIds()
    expect(new Set(ids).size, 'renumbered node keeps a distinct id').toBe(2)

    await comfyPage.vueNodes.selectNodes([ids[0]])
    await comfyPage.page.keyboard.press('Delete')

    await expect(comfyPage.vueNodes.nodes).toHaveCount(1)
    await expect(comfyPage.vueNodes.getNodeLocator(ids[1])).toBeVisible()
  })
})
