import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '../../fixtures/ComfyPage'
import { VueNodeFixture } from '../../fixtures/utils/vueNodeFixtures'

test.describe('NodeHeader', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.UseNewMenu', 'Enabled')
    await comfyPage.setSetting('Comfy.Graph.CanvasMenu', false)
    await comfyPage.setSetting('Comfy.EnableTooltips', true)
    await comfyPage.setup()
    // Load single SaveImage node workflow (positioned below menu bar)
    await comfyPage.loadWorkflow('nodes/single_save_image_node')
  })

  test('displays node title', async ({ comfyPage }) => {
    // Get the single SaveImage node from the workflow
    const nodes = await comfyPage.getNodeRefsByType('SaveImage')
    expect(nodes.length).toBeGreaterThanOrEqual(1)

    const node = nodes[0]
    const vueNode = new VueNodeFixture(node, comfyPage.page)

    const title = await vueNode.getTitle()
    expect(title).toBe('Save Image')

    // Verify title is visible in the header
    const header = await vueNode.getHeader()
    await expect(header).toContainText('Save Image')
  })

  test('allows title renaming', async ({ comfyPage }) => {
    // Get the single SaveImage node from the workflow
    const nodes = await comfyPage.getNodeRefsByType('SaveImage')
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

  test('handles node collapsing', async ({ comfyPage }) => {
    // Get the single SaveImage node from the workflow
    const nodes = await comfyPage.getNodeRefsByType('SaveImage')
    const node = nodes[0]
    const vueNode = new VueNodeFixture(node, comfyPage.page)

    // Initially should not be collapsed
    expect(await node.isCollapsed()).toBe(false)
    const body = await vueNode.getBody()
    await expect(body).toBeVisible()

    // Collapse the node
    await vueNode.toggleCollapse()
    expect(await node.isCollapsed()).toBe(true)

    // Verify node content is hidden
    const collapsedSize = await node.getSize()
    await expect(body).not.toBeVisible()

    // Expand again
    await vueNode.toggleCollapse()
    expect(await node.isCollapsed()).toBe(false)
    await expect(body).toBeVisible()

    // Size should be restored
    const expandedSize = await node.getSize()
    expect(expandedSize.height).toBeGreaterThanOrEqual(collapsedSize.height)
  })

  test('shows collapse/expand icon state', async ({ comfyPage }) => {
    // Get the single SaveImage node from the workflow
    const nodes = await comfyPage.getNodeRefsByType('SaveImage')
    const node = nodes[0]
    const vueNode = new VueNodeFixture(node, comfyPage.page)

    // Check initial expanded state icon
    let iconClass = await vueNode.getCollapseIconClass()
    expect(iconClass).toContain('pi-chevron-down')

    // Collapse and check icon
    await vueNode.toggleCollapse()
    iconClass = await vueNode.getCollapseIconClass()
    expect(iconClass).toContain('pi-chevron-right')

    // Expand and check icon
    await vueNode.toggleCollapse()
    iconClass = await vueNode.getCollapseIconClass()
    expect(iconClass).toContain('pi-chevron-down')
  })

  test('preserves title when collapsing/expanding', async ({ comfyPage }) => {
    // Get the single SaveImage node from the workflow
    const nodes = await comfyPage.getNodeRefsByType('SaveImage')
    const node = nodes[0]
    const vueNode = new VueNodeFixture(node, comfyPage.page)

    // Set custom title
    await vueNode.setTitle('Test Sampler')
    expect(await vueNode.getTitle()).toBe('Test Sampler')

    // Collapse
    await vueNode.toggleCollapse()
    expect(await vueNode.getTitle()).toBe('Test Sampler')

    // Expand
    await vueNode.toggleCollapse()
    expect(await vueNode.getTitle()).toBe('Test Sampler')

    // Verify title is still displayed
    const header = await vueNode.getHeader()
    await expect(header).toContainText('Test Sampler')
  })
})
