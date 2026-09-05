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

  test('collapse button takes priority over the resize handle', async ({
    comfyPage
  }) => {
    const vueNode = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
    const nodeRef = await comfyPage.nodeOps.getNodeRefById('3')
    const positionBefore = await nodeRef.getProperty<[number, number]>('pos')
    const buttonBox = await vueNode.collapseButton.boundingBox()
    if (!buttonBox) throw new Error('Collapse button has no bounding box')

    const clickPoint = {
      x: buttonBox.x + 2,
      y: buttonBox.y + buttonBox.height / 2
    }
    const hitsCollapseButton = await comfyPage.page.evaluate(({ x, y }) => {
      return Boolean(
        document
          .elementFromPoint(x, y)
          ?.closest('[data-testid="node-collapse-button"]')
      )
    }, clickPoint)
    expect(hitsCollapseButton).toBe(true)

    await comfyPage.page.mouse.click(clickPoint.x, clickPoint.y)
    await comfyPage.nextFrame()

    await expect(vueNode.body).toBeHidden()
    await expect
      .poll(() => nodeRef.getProperty<[number, number]>('pos'))
      .toEqual(positionBefore)
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

test.describe(
  'Collapsed node hit testing',
  { tag: ['@vue-nodes', '@canvas', '@node'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('vueNodes/collapsed-neighbors')
      await comfyPage.vueNodes.waitForNodes(3)
    })

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.canvasOps.resetView()
    })

    test('ignores separator overflow outside the visible header', async ({
      comfyPage
    }) => {
      const node = comfyPage.vueNodes.getNodeLocator('39')
      const nodeRef = await comfyPage.nodeOps.getNodeRefById('39')
      const box = await node.boundingBox()
      if (!box) throw new Error('Collapsed node has no bounding box')

      const overflowPoint = {
        x: box.x + box.width + 6,
        y: box.y + box.height / 2
      }
      const hitNodeId = await comfyPage.page.evaluate(({ x, y }) => {
        return (
          document
            .elementFromPoint(x, y)
            ?.closest<HTMLElement>('[data-node-id]')?.dataset.nodeId ?? null
        )
      }, overflowPoint)
      expect(hitNodeId).toBeNull()

      const positionBefore = await nodeRef.getProperty<[number, number]>('pos')
      await comfyPage.page.mouse.move(overflowPoint.x, overflowPoint.y)
      await comfyPage.page.mouse.down()
      await comfyPage.page.mouse.move(
        overflowPoint.x + 50,
        overflowPoint.y + 50,
        { steps: 10 }
      )
      await comfyPage.page.mouse.up()
      await comfyPage.nextFrame()

      await expect
        .poll(() => nodeRef.getProperty<[number, number]>('pos'))
        .toEqual(positionBefore)
    })

    test('keeps neighboring visible headers independently draggable', async ({
      comfyPage
    }) => {
      for (const { nodeId, fromRight } of [
        { nodeId: '37', fromRight: true },
        { nodeId: '38', fromRight: true },
        { nodeId: '39', fromRight: false }
      ]) {
        const node = comfyPage.vueNodes.getNodeLocator(nodeId)
        const nodeRef = await comfyPage.nodeOps.getNodeRefById(nodeId)
        const box = await node.boundingBox()
        if (!box)
          throw new Error(`Collapsed node ${nodeId} has no bounding box`)

        const dragPoint = {
          x: box.x + (fromRight ? box.width - 2 : 2),
          y: box.y + box.height / 2
        }
        const positionBefore =
          await nodeRef.getProperty<[number, number]>('pos')

        await comfyPage.page.mouse.move(dragPoint.x, dragPoint.y)
        await comfyPage.page.mouse.down()
        await comfyPage.page.mouse.move(dragPoint.x, dragPoint.y + 50, {
          steps: 10
        })
        await comfyPage.page.mouse.up()
        await comfyPage.nextFrame()

        await expect
          .poll(() => nodeRef.getProperty<[number, number]>('pos'))
          .not.toEqual(positionBefore)
        await expect(node).toHaveClass(/outline-node-component-outline/)
        await expect(comfyPage.vueNodes.selectedNodes).toHaveCount(1)
      }
    })
  }
)
