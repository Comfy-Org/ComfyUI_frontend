import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '../fixtures/ComfyPage'

test.beforeEach(async ({ comfyPage }) => {
  await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
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

    const nodeRef = (await comfyPage.nodeOps.getNodeRefsByTitle('KSampler'))[0]

    const bypassButton = comfyPage.page.locator(
      '[data-testid="bypass-button"]'
    )
    await expect(bypassButton).toBeVisible()
    await bypassButton.click()
    await comfyPage.nextFrame()

    await expect(nodeRef).toBeBypassed()

    // Re-select the node to show toolbox again
    await comfyPage.nodeOps.selectNodes(['KSampler'])
    await comfyPage.nextFrame()

    await expect(bypassButton).toBeVisible()
    await bypassButton.click()
    await comfyPage.nextFrame()

    await expect(nodeRef).not.toBeBypassed()
  })

  test('delete button removes selected node', async ({ comfyPage }) => {
    await comfyPage.nodeOps.selectNodes(['KSampler'])
    await comfyPage.nextFrame()

    const initialCount = await comfyPage.page.evaluate(
      () => window.app!.graph!._nodes.length
    )

    const deleteButton = comfyPage.page.locator(
      '[data-testid="delete-button"]'
    )
    await expect(deleteButton).toBeVisible()
    await deleteButton.click()
    await comfyPage.nextFrame()

    const newCount = await comfyPage.page.evaluate(
      () => window.app!.graph!._nodes.length
    )
    expect(newCount).toBe(initialCount - 1)
  })

  test('info button opens properties panel', async ({ comfyPage }) => {
    await comfyPage.nodeOps.selectNodes(['KSampler'])
    await comfyPage.nextFrame()

    const infoButton = comfyPage.page.locator('[data-testid="info-button"]')
    await expect(infoButton).toBeVisible()
    await infoButton.click()
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

    const deleteButton = comfyPage.page.locator(
      '[data-testid="delete-button"]'
    )
    await expect(deleteButton).toBeVisible()
    await deleteButton.click()
    await comfyPage.nextFrame()

    const newCount = await comfyPage.page.evaluate(
      () => window.app!.graph!._nodes.length
    )
    expect(newCount).toBe(initialCount - 2)
  })
})
