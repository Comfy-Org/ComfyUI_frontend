import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe('Vue Node Collapse', { tag: '@vue-nodes' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.EnableTooltips', true)
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
    await expect(body).toBeHidden()
    await expect
      .poll(async () => (await vueNode.boundingBox())?.height)
      .toBeLessThan(expandedBoundingBox.height)

    // Expand again
    await vueNode.toggleCollapse()
    await comfyPage.nextFrame()
    await expect(body).toBeVisible()

    // Size should be restored
    await expect
      .poll(async () => (await vueNode.boundingBox())?.height)
      .toBeGreaterThanOrEqual(expandedBoundingBox.height)
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

  test('should keep a resized width across a collapsed save and reload', async ({
    comfyPage
  }) => {
    test.setTimeout(30000)

    const { beforeCollapse, resizedWidth } =
      await test.step('Resize and collapse the node', async () => {
        const vueNode = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
        await expect(vueNode.root).toBeVisible()

        await vueNode.resizeFromCorner('SE', 120, 0)
        await comfyPage.nextFrame()
        const resized = await vueNode.boundingBox()
        expect(resized, 'Measure resized node').not.toBeNull()
        const resizedWidth = resized?.width ?? 0

        const beforeCollapse = Date.now()
        await vueNode.select()
        await comfyPage.keyboard.press('Alt+KeyC')
        await expect
          .poll(async () => (await vueNode.boundingBox())?.width)
          .toBeLessThan(resizedWidth)

        return { beforeCollapse, resizedWidth }
      })

    await test.step('Save and reload the collapsed node', async () => {
      await comfyPage.workflow.waitForDraftIndexUpdatedSince(beforeCollapse)
      await comfyPage.workflow.reloadAndWaitForApp()
    })

    await test.step('Expand to the saved width', async () => {
      const reloaded = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
      await expect(reloaded.root).toBeVisible()
      await reloaded.select()
      await comfyPage.keyboard.press('Alt+KeyC')
      await comfyPage.nextFrame()

      await expect
        .poll(async () => (await reloaded.boundingBox())?.width)
        .toBeGreaterThan(resizedWidth - 5)
      await expect
        .poll(async () => (await reloaded.boundingBox())?.width)
        .toBeLessThan(resizedWidth + 5)
    })
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
