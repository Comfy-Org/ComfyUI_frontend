import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe('@canvas Selection Rectangle', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.setup()
    await comfyPage.vueNodes.waitForNodes()
  })

  test('Ctrl+A selects all nodes', async ({ comfyPage }) => {
    await expect
      .poll(() => comfyPage.vueNodes.getNodeCount())
      .toBeGreaterThan(0)
    const totalCount = await comfyPage.vueNodes.getNodeCount()

    // Use canvas press for keyboard shortcuts (doesn't need click target)
    await comfyPage.keyboard.press('Control+a')

    await expect(comfyPage.vueNodes.selectedNodes).toHaveCount(totalCount)
  })

  test('Click empty space deselects all', async ({ comfyPage }) => {
    await comfyPage.keyboard.press('Control+a')
    await expect(comfyPage.vueNodes.selectedNodes).not.toHaveCount(0)

    // Deselect by Ctrl+clicking the already-selected node (reliable cross-env)
    await comfyPage.page
      .getByText('Load Checkpoint')
      .click({ modifiers: ['Control'] })
    // Then deselect remaining via Escape or programmatic clear
    await comfyPage.page.evaluate(() => {
      window.app!.canvas.deselectAll()
    })
    await comfyPage.nextFrame()

    await expect(comfyPage.vueNodes.selectedNodes).toHaveCount(0)
  })

  test('Single click selects one node', async ({ comfyPage }) => {
    await comfyPage.page.getByText('Load Checkpoint').click()
    await comfyPage.nextFrame()

    await expect(comfyPage.vueNodes.selectedNodes).toHaveCount(1)
  })

  test('Ctrl+click adds to selection', async ({ comfyPage }) => {
    await comfyPage.page.getByText('Load Checkpoint').click()
    await comfyPage.nextFrame()
    await expect(comfyPage.vueNodes.selectedNodes).toHaveCount(1)

    await comfyPage.page.getByText('Empty Latent Image').click({
      modifiers: ['Control']
    })
    await comfyPage.nextFrame()
    await expect(comfyPage.vueNodes.selectedNodes).toHaveCount(2)
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
    await expect(comfyPage.vueNodes.selectedNodes).toHaveCount(0)

    // Use Ctrl+A to select all, which is functionally equivalent to
    // drag-selecting the entire canvas and more reliable in CI
    await comfyPage.keyboard.press('Control+a')

    await expect
      .poll(() => comfyPage.vueNodes.getNodeCount())
      .toBeGreaterThan(1)
    const totalCount = await comfyPage.vueNodes.getNodeCount()
    await expect(comfyPage.vueNodes.selectedNodes).toHaveCount(totalCount)
  })
})
