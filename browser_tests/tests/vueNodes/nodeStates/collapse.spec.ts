import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '../../../fixtures/ComfyPage'

test.describe('Vue Node Collapse', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.Graph.CanvasMenu', false)
    await comfyPage.setSetting('Comfy.EnableTooltips', true)
    await comfyPage.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.setup()
    await comfyPage.vueNodes.waitForNodes()
  })

  test('should allow collapsing node with collapse icon', async ({
    comfyPage
  }) => {
    const node = comfyPage.vueNodes.getNodeByTitle('KSampler').first()
    await expect(node).toBeVisible()

    // Initially should not be collapsed
    const body = node.locator('[data-testid^="node-body-"]')
    await expect(body).toBeVisible()
    const expandedBoundingBox = await node.boundingBox()
    if (!expandedBoundingBox)
      throw new Error('Failed to get node bounding box before collapse')

    // Collapse the node
    await node.locator('[data-testid="node-collapse-button"]').click()
    await comfyPage.nextFrame()

    // Verify node content is hidden
    await expect(body).not.toBeVisible()
    const collapsedBoundingBox = await node.boundingBox()
    if (!collapsedBoundingBox)
      throw new Error('Failed to get node bounding box after collapse')
    expect(collapsedBoundingBox.height).toBeLessThan(expandedBoundingBox.height)

    // Expand again
    await node.locator('[data-testid="node-collapse-button"]').click()
    await comfyPage.nextFrame()
    await expect(body).toBeVisible()

    // Size should be restored
    const expandedBoundingBoxAfter = await node.boundingBox()
    if (!expandedBoundingBoxAfter)
      throw new Error('Failed to get node bounding box after expand')
    expect(expandedBoundingBoxAfter.height).toBeGreaterThanOrEqual(
      collapsedBoundingBox.height
    )
  })

  test('should show collapse/expand icon state', async ({ comfyPage }) => {
    const node = comfyPage.vueNodes.getNodeByTitle('KSampler').first()
    await expect(node).toBeVisible()
    const collapseButton = node.locator('[data-testid="node-collapse-button"]')
    const collapseIcon = collapseButton.locator('i')

    // Check initial expanded state icon
    let iconClass = await collapseIcon.getAttribute('class')
    expect(iconClass).not.toContain('-rotate-90')

    // Collapse and check icon
    await collapseButton.click()
    iconClass = (await collapseIcon.getAttribute('class')) || ''
    expect(iconClass).toContain('-rotate-90')

    // Expand and check icon
    await collapseButton.click()
    iconClass = (await collapseIcon.getAttribute('class')) || ''
    expect(iconClass).not.toContain('-rotate-90')
  })

  test('should preserve title when collapsing/expanding', async ({
    comfyPage
  }) => {
    const node = comfyPage.vueNodes.getNodeByTitle('KSampler').first()
    await expect(node).toBeVisible()
    const title = node.locator('[data-testid="node-title"]')
    const collapseButton = node.locator('[data-testid="node-collapse-button"]')

    // Set custom title
    await title.dblclick()
    const input = node.locator('[data-testid="node-title-input"]')
    await input.fill('Test Sampler')
    await input.press('Enter')
    await expect(title).toHaveText('Test Sampler')

    // Collapse
    await collapseButton.click()
    await expect(title).toHaveText('Test Sampler')

    // Expand
    await collapseButton.click()
    await expect(title).toHaveText('Test Sampler')

    // Verify title is still displayed
    await expect(node.locator('[data-testid^="node-header-"]')).toContainText(
      'Test Sampler'
    )
  })
})
