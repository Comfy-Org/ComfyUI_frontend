import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe('Vue Nodes Renaming', { tag: '@vue-nodes' }, () => {
  test('should display node title', async ({ comfyPage }) => {
    const vueNode = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
    await expect(vueNode.header).toContainText('KSampler')
  })

  test('should allow title renaming by double clicking on the node header', async ({
    comfyPage
  }) => {
    const vueNode = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
    // Test renaming with Enter
    await vueNode.setTitle('My Custom Sampler')
    await expect(vueNode.title).toHaveText('My Custom Sampler')
    await expect(vueNode.header).toContainText('My Custom Sampler')

    // Test cancel with Escape
    await vueNode.title.dblclick()
    await comfyPage.nextFrame()
    await vueNode.titleEditor.input.fill('This Should Be Cancelled')
    await vueNode.titleEditor.cancel()
    await comfyPage.nextFrame()

    // Title should remain as the previously saved value
    await expect(vueNode.title).toHaveText('My Custom Sampler')
  })

  test('Double click node body does not trigger edit', async ({
    comfyPage
  }) => {
    const loadCheckpointNode = comfyPage.vueNodes
      .getNodeByTitle('Load Checkpoint')
      .first()
    const nodeBbox = await loadCheckpointNode.boundingBox()
    if (!nodeBbox) throw new Error('Node not found')
    await loadCheckpointNode.dblclick()

    await comfyPage.titleEditor.expectHidden()
  })
})
