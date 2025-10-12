import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '../../../../fixtures/ComfyPage'

test.describe('Vue Nodes Renaming', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.Graph.CanvasMenu', false)
    await comfyPage.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.setup()
    await comfyPage.vueNodes.waitForNodes()
  })

  test('should display node title', async ({ comfyPage }) => {
    const vueNode = comfyPage.vueNodes.getFixtureByTitle('KSampler')
    await expect(vueNode.header).toContainText('KSampler')
  })

  test('should allow title renaming by double clicking on the node header', async ({
    comfyPage
  }) => {
    const vueNode = comfyPage.vueNodes.getFixtureByTitle('KSampler')
    const title = vueNode.title
    const titleInput = vueNode.titleInput

    // Test renaming with Enter
    await title.dblclick()
    await titleInput.fill('My Custom Sampler')
    await titleInput.press('Enter')
    await expect(title).toHaveText('My Custom Sampler')

    // Verify the title is displayed
    await expect(vueNode.header).toContainText('My Custom Sampler')

    // Test cancel with Escape
    await title.dblclick()
    await comfyPage.nextFrame()

    // Type a different value but cancel
    await titleInput.fill('This Should Be Cancelled')
    await titleInput.press('Escape')
    await comfyPage.nextFrame()

    // Title should remain as the previously saved value
    await expect(title).toHaveText('My Custom Sampler')
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

    const editingTitleInput = comfyPage.page.getByTestId('node-title-input')
    await expect(editingTitleInput).not.toBeVisible()
  })
})
