import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe('Vue Node Collapse', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.Graph.CanvasMenu', false)
    await comfyPage.settings.setSetting('Comfy.EnableTooltips', true)
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.setup()
    await comfyPage.vueNodes.waitForNodes()
  })

  test('should allow collapsing node with collapse icon', async ({
    comfyPage
  }) => {
    const vueNode = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
    await expect(vueNode.root).toBeVisible()

    // Initially should not be collapsed
    const body = vueNode.body
    await expect(body).toBeVisible()
    const expandedBoundingBox = await vueNode.boundingBox()
    if (!expandedBoundingBox)
      throw new Error('Failed to get node bounding box before collapse')

    // Collapse the node
    await vueNode.toggleCollapse()
    await comfyPage.nextFrame()

    // Verify node content is hidden
    await expect(body).not.toBeVisible()
    const collapsedBoundingBox = await vueNode.boundingBox()
    if (!collapsedBoundingBox)
      throw new Error('Failed to get node bounding box after collapse')
    expect(collapsedBoundingBox.height).toBeLessThan(expandedBoundingBox.height)

    // Expand again
    await vueNode.toggleCollapse()
    await comfyPage.nextFrame()
    await expect(body).toBeVisible()

    // Size should be restored
    const expandedBoundingBoxAfter = await vueNode.boundingBox()
    if (!expandedBoundingBoxAfter)
      throw new Error('Failed to get node bounding box after expand')
    expect(expandedBoundingBoxAfter.height).toBeGreaterThanOrEqual(
      collapsedBoundingBox.height
    )
  })

  test('should show collapse/expand icon state', async ({ comfyPage }) => {
    const vueNode = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
    await expect(vueNode.root).toBeVisible()

    // Check initial expanded state icon
    await expect(vueNode.collapseIcon).not.toHaveClass(/-rotate-90/)

    // Collapse and check icon
    await vueNode.toggleCollapse()
    await expect(vueNode.collapseIcon).toHaveClass(/-rotate-90/)

    // Expand and check icon
    await vueNode.toggleCollapse()
    await expect(vueNode.collapseIcon).not.toHaveClass(/-rotate-90/)
  })

  test('should preserve title when collapsing/expanding', async ({
    comfyPage
  }) => {
    const vueNode = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
    await expect(vueNode.root).toBeVisible()

    // Set custom title
    await vueNode.setTitle('Test Sampler')
    await expect(vueNode.title).toHaveText('Test Sampler')

    // Collapse
    await vueNode.toggleCollapse()
    await expect(vueNode.title).toHaveText('Test Sampler')

    // Expand
    await vueNode.toggleCollapse()
    await expect(vueNode.title).toHaveText('Test Sampler')

    // Verify title is still displayed
    await expect(vueNode.header).toContainText('Test Sampler')
  })
})
