import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '../../../fixtures/ComfyPage'
import { VueNodeFixture } from '../../../fixtures/utils/vueNodeFixtures'

test.describe('Vue Node Collapse', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.Graph.CanvasMenu', false)
    await comfyPage.setSetting('Comfy.EnableTooltips', true)
    await comfyPage.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.setup()
  })

  test('should allow collapsing node with collapse icon', async ({
    comfyPage
  }) => {
    // Get the KSampler node from the default workflow
    const nodes = await comfyPage.getNodeRefsByType('KSampler')
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

  test('should show collapse/expand icon state', async ({ comfyPage }) => {
    const nodes = await comfyPage.getNodeRefsByType('KSampler')
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

  test('should preserve title when collapsing/expanding', async ({
    comfyPage
  }) => {
    const nodes = await comfyPage.getNodeRefsByType('KSampler')
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
