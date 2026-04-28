import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe('Vue Node Resizing', { tag: '@vue-nodes' }, () => {
  test('should resize node without position drift after selecting', async ({
    comfyPage
  }) => {
    // Get a Vue node fixture
    const node = await comfyPage.vueNodes.getFixtureByTitle('Load Checkpoint')
    const initialBox = await node.boundingBox()
    if (!initialBox) throw new Error('Node bounding box not found')

    // Select the node first (this was causing the bug)
    await node.header.click()

    // Get position after selection
    const selectedBox = await node.boundingBox()
    if (!selectedBox)
      throw new Error('Node bounding box not found after select')

    // Verify position unchanged after selection
    await expect
      .poll(async () => (await node.boundingBox())?.x)
      .toBeCloseTo(initialBox.x, 1)
    await expect
      .poll(async () => (await node.boundingBox())?.y)
      .toBeCloseTo(initialBox.y, 1)

    // Now resize from bottom-right corner
    const resizeStartX = selectedBox.x + selectedBox.width - 5
    const resizeStartY = selectedBox.y + selectedBox.height - 5

    await comfyPage.page.mouse.move(resizeStartX, resizeStartY)
    await comfyPage.page.mouse.down()
    await comfyPage.page.mouse.move(resizeStartX + 50, resizeStartY + 30)
    await comfyPage.page.mouse.up()

    // Position should NOT have changed (the bug was position drift)
    await expect
      .poll(async () => (await node.boundingBox())?.x)
      .toBeCloseTo(initialBox.x, 1)
    await expect
      .poll(async () => (await node.boundingBox())?.y)
      .toBeCloseTo(initialBox.y, 1)

    // Size should have increased
    await expect
      .poll(async () => (await node.boundingBox())?.width)
      .toBeGreaterThan(initialBox.width)
    await expect
      .poll(async () => (await node.boundingBox())?.height)
      .toBeGreaterThan(initialBox.height)
  })
})
