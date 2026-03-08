import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '../fixtures/ComfyPage'

test.describe('@canvas Selection Rectangle', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.setup()
    await comfyPage.vueNodes.waitForNodes()
  })

  test('Ctrl+A selects all nodes', async ({ comfyPage }) => {
    const totalCount = await comfyPage.vueNodes.getNodeCount()
    expect(totalCount).toBeGreaterThan(0)

    // Use canvas press for keyboard shortcuts (doesn't need click target)
    await comfyPage.canvas.press('Control+a')
    await comfyPage.nextFrame()

    expect(await comfyPage.vueNodes.getSelectedNodeCount()).toBe(totalCount)
  })

  test('Click empty space deselects all', async ({ comfyPage }) => {
    await comfyPage.canvas.press('Control+a')
    await comfyPage.nextFrame()
    expect(await comfyPage.vueNodes.getSelectedNodeCount()).toBeGreaterThan(0)

    await comfyPage.vueNodes.clearSelection()
    await comfyPage.nextFrame()

    expect(await comfyPage.vueNodes.getSelectedNodeCount()).toBe(0)
  })

  test('Single click selects one node', async ({ comfyPage }) => {
    await comfyPage.page.getByText('Load Checkpoint').click()
    await comfyPage.nextFrame()

    expect(await comfyPage.vueNodes.getSelectedNodeCount()).toBe(1)
  })

  test('Ctrl+click adds to selection', async ({ comfyPage }) => {
    await comfyPage.page.getByText('Load Checkpoint').click()
    await comfyPage.nextFrame()
    expect(await comfyPage.vueNodes.getSelectedNodeCount()).toBe(1)

    await comfyPage.page.getByText('Empty Latent Image').click({
      modifiers: ['Control']
    })
    await comfyPage.nextFrame()
    expect(await comfyPage.vueNodes.getSelectedNodeCount()).toBe(2)
  })

  test('Selected nodes have visual indicator', async ({ comfyPage }) => {
    const checkpointNode = comfyPage.vueNodes.getNodeByTitle('Load Checkpoint')

    await comfyPage.page.getByText('Load Checkpoint').click()
    await comfyPage.nextFrame()

    await expect(checkpointNode).toHaveClass(/outline-node-component-outline/)
  })

  test('Drag-select rectangle selects multiple nodes', async ({
    comfyPage
  }) => {
    expect(await comfyPage.vueNodes.getSelectedNodeCount()).toBe(0)

    // Use page.mouse directly for drag operations to avoid canvas click issues
    await comfyPage.page.mouse.move(10, 400)
    await comfyPage.page.mouse.down()
    await comfyPage.page.mouse.move(800, 600, { steps: 10 })
    await comfyPage.page.mouse.up()
    await comfyPage.nextFrame()

    expect(await comfyPage.vueNodes.getSelectedNodeCount()).toBeGreaterThan(1)
  })
})
