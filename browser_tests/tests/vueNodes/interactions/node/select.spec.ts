import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '../../../../fixtures/ComfyPage'

test.beforeEach(async ({ comfyPage }) => {
  await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
})

test.describe('Vue Node Selection', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.vueNodes.waitForNodes()
  })

  const modifiers = [
    { key: 'Control', name: 'ctrl' },
    { key: 'Shift', name: 'shift' },
    { key: 'Meta', name: 'meta' }
  ] as const

  for (const { key: modifier, name } of modifiers) {
    test(`should allow selecting multiple nodes with ${name}+click`, async ({
      comfyPage
    }) => {
      await comfyPage.page.getByText('Load Checkpoint').click()
      await expect.poll(() => comfyPage.vueNodes.getSelectedNodeCount()).toBe(1)

      await comfyPage.page.getByText('Empty Latent Image').click({
        modifiers: [modifier]
      })
      await expect.poll(() => comfyPage.vueNodes.getSelectedNodeCount()).toBe(2)

      await comfyPage.page.getByText('KSampler').click({
        modifiers: [modifier]
      })
      await expect.poll(() => comfyPage.vueNodes.getSelectedNodeCount()).toBe(3)
    })

    test(`should allow de-selecting nodes with ${name}+click`, async ({
      comfyPage
    }) => {
      await comfyPage.page.getByText('Load Checkpoint').click()
      await expect.poll(() => comfyPage.vueNodes.getSelectedNodeCount()).toBe(1)

      await comfyPage.page.getByText('Load Checkpoint').click({
        modifiers: [modifier]
      })
      await expect.poll(() => comfyPage.vueNodes.getSelectedNodeCount()).toBe(0)
    })
  }

  test('should select all nodes with ctrl+a', async ({ comfyPage }) => {
    await expect
      .poll(() => comfyPage.vueNodes.getNodeCount())
      .toBeGreaterThan(0)
    const initialCount = await comfyPage.vueNodes.getNodeCount()

    await comfyPage.canvas.press('Control+a')

    await expect
      .poll(() => comfyPage.vueNodes.getSelectedNodeCount())
      .toBe(initialCount)
  })

  test('should select pinned node without dragging', async ({ comfyPage }) => {
    const PIN_HOTKEY = 'p'
    const PIN_INDICATOR = '[data-testid="node-pin-indicator"]'

    const checkpointNodeHeader = comfyPage.page.getByText('Load Checkpoint')
    await checkpointNodeHeader.click()

    await comfyPage.page.keyboard.press(PIN_HOTKEY)

    const checkpointNode = comfyPage.vueNodes.getNodeByTitle('Load Checkpoint')
    const pinIndicator = checkpointNode.locator(PIN_INDICATOR)
    await expect(pinIndicator).toBeVisible()

    await expect.poll(() => comfyPage.vueNodes.getSelectedNodeCount()).toBe(1)

    const initialPos = await checkpointNodeHeader.boundingBox()
    if (!initialPos) throw new Error('Failed to get header position')

    await comfyPage.canvasOps.dragAndDrop(
      { x: initialPos.x + 10, y: initialPos.y + 10 },
      { x: initialPos.x + 100, y: initialPos.y + 100 }
    )

    const finalPos = await checkpointNodeHeader.boundingBox()
    if (!finalPos) throw new Error('Failed to get header position after drag')
    expect(finalPos).toEqual(initialPos)

    await expect.poll(() => comfyPage.vueNodes.getSelectedNodeCount()).toBe(1)
  })
})
