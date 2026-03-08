import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '../fixtures/ComfyPage'

test.beforeEach(async ({ comfyPage }) => {
  await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
})

test.describe('Selection Toolbox - Button Actions', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.Canvas.SelectionToolbox', true)
    await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')
    await comfyPage.nextFrame()
  })

  test('bypass button toggles node bypass state', async ({ comfyPage }) => {
    await comfyPage.nodeOps.selectNodes(['KSampler'])
    await comfyPage.nextFrame()

    const nodeRef = (
      await comfyPage.nodeOps.getNodeRefsByTitle('KSampler')
    )[0]

    // Click bypass button to bypass the node
    await comfyPage.page.locator('[data-testid="bypass-button"]').click()
    await comfyPage.nextFrame()

    await expect(nodeRef).toBeBypassed()

    // Re-select the node to show toolbox again
    await comfyPage.nodeOps.selectNodes(['KSampler'])
    await comfyPage.nextFrame()

    // Click bypass button again to un-bypass
    await comfyPage.page.locator('[data-testid="bypass-button"]').click()
    await comfyPage.nextFrame()

    await expect(nodeRef).not.toBeBypassed()
  })

  test('delete button removes selected node', async ({ comfyPage }) => {
    await comfyPage.nodeOps.selectNodes(['KSampler'])
    await comfyPage.nextFrame()

    const initialCount = await comfyPage.page.evaluate(
      () => window.app!.graph!._nodes.length
    )

    await comfyPage.page.locator('[data-testid="delete-button"]').click()
    await comfyPage.nextFrame()

    const newCount = await comfyPage.page.evaluate(
      () => window.app!.graph!._nodes.length
    )
    expect(newCount).toBe(initialCount - 1)
  })

  test('info button opens properties panel', async ({ comfyPage }) => {
    await comfyPage.nodeOps.selectNodes(['KSampler'])
    await comfyPage.nextFrame()

    await comfyPage.page.locator('[data-testid="info-button"]').click()
    await comfyPage.nextFrame()

    await expect(
      comfyPage.page.locator('[data-testid="properties-panel"]')
    ).toBeVisible()
  })

  test('refresh button is visible when node is selected', async ({
    comfyPage
  }) => {
    await comfyPage.nodeOps.selectNodes(['KSampler'])
    await comfyPage.nextFrame()

    await expect(
      comfyPage.page.locator('[data-testid="refresh-button"]')
    ).toBeVisible()
  })

  test('convert-to-subgraph button visible with multi-select', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('default')
    await comfyPage.nextFrame()

    await comfyPage.nodeOps.selectNodes([
      'KSampler',
      'CLIP Text Encode (Prompt)'
    ])
    await comfyPage.nextFrame()

    await expect(
      comfyPage.page.locator('[data-testid="convert-to-subgraph-button"]')
    ).toBeVisible()
  })

  test('delete button removes multiple selected nodes', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('default')
    await comfyPage.nextFrame()

    await comfyPage.nodeOps.selectNodes([
      'KSampler',
      'CLIP Text Encode (Prompt)'
    ])
    await comfyPage.nextFrame()

    const initialCount = await comfyPage.page.evaluate(
      () => window.app!.graph!._nodes.length
    )

    await comfyPage.page.locator('[data-testid="delete-button"]').click()
    await comfyPage.nextFrame()

    const newCount = await comfyPage.page.evaluate(
      () => window.app!.graph!._nodes.length
    )
    expect(newCount).toBe(initialCount - 2)
  })
})
