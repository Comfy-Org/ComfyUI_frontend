import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '../../../../../fixtures/ComfyPage'
import { VueNodeFixture } from '../../../../../fixtures/utils/vueNodeFixtures'

test.describe('Vue Nodes Renaming', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.Graph.CanvasMenu', false)
    await comfyPage.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.setup()
  })

  test('should display node title', async ({ comfyPage }) => {
    // Get the KSampler node from the default workflow
    const nodes = await comfyPage.getNodeRefsByType('KSampler')
    expect(nodes.length).toBeGreaterThanOrEqual(1)

    const node = nodes[0]
    const vueNode = new VueNodeFixture(node, comfyPage.page)

    const title = await vueNode.getTitle()
    expect(title).toBe('KSampler')

    // Verify title is visible in the header
    const header = await vueNode.getHeader()
    await expect(header).toContainText('KSampler')
  })

  test('should allow title renaming by double clicking on the node header', async ({
    comfyPage
  }) => {
    const nodes = await comfyPage.getNodeRefsByType('KSampler')
    const node = nodes[0]
    const vueNode = new VueNodeFixture(node, comfyPage.page)

    // Test renaming with Enter
    await vueNode.setTitle('My Custom Sampler')
    const newTitle = await vueNode.getTitle()
    expect(newTitle).toBe('My Custom Sampler')

    // Verify the title is displayed
    const header = await vueNode.getHeader()
    await expect(header).toContainText('My Custom Sampler')

    // Test cancel with Escape
    const titleElement = await vueNode.getTitleElement()
    await titleElement.dblclick()
    await comfyPage.nextFrame()

    // Type a different value but cancel
    const input = (await vueNode.getHeader()).locator(
      '[data-testid="node-title-input"]'
    )
    await input.fill('This Should Be Cancelled')
    await input.press('Escape')
    await comfyPage.nextFrame()

    // Title should remain as the previously saved value
    const titleAfterCancel = await vueNode.getTitle()
    expect(titleAfterCancel).toBe('My Custom Sampler')
  })

  test('Double click node body does not trigger edit', async ({
    comfyPage
  }) => {
    const loadCheckpointNode =
      comfyPage.vueNodes.getNodeByTitle('Load Checkpoint')
    const nodeBbox = await loadCheckpointNode.boundingBox()
    if (!nodeBbox) throw new Error('Node not found')
    await loadCheckpointNode.dblclick()

    const editingTitleInput = comfyPage.page.getByTestId('node-title-input')
    await expect(editingTitleInput).not.toBeVisible()
  })
})
