import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '../fixtures/ComfyPage'
import type { NodeReference } from '../fixtures/utils/litegraphUtils'
import type { ComfyPage } from '../fixtures/ComfyPage'

async function selectNodeWithPan(comfyPage: ComfyPage, nodeRef: NodeReference) {
  const nodePos = await nodeRef.getPosition()
  await comfyPage.page.evaluate((pos) => {
    const canvas = window.app!.canvas
    canvas.ds.offset[0] = -pos.x + canvas.canvas.width / 2
    canvas.ds.offset[1] = -pos.y + canvas.canvas.height / 2 + 100
    canvas.setDirty(true, true)
  }, nodePos)
  await comfyPage.nextFrame()
  await nodeRef.click('title')
}

test.beforeEach(async ({ comfyPage }) => {
  await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
})

test.describe('Selection Toolbox - Button Actions', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.Canvas.SelectionToolbox', true)
    await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')
    await comfyPage.nextFrame()
  })

  test('delete button removes selected node', async ({ comfyPage }) => {
    const nodeRef = (await comfyPage.nodeOps.getNodeRefsByTitle('KSampler'))[0]
    await selectNodeWithPan(comfyPage, nodeRef)

    const initialCount = await comfyPage.page.evaluate(
      () => window.app!.graph!._nodes.length
    )

    const deleteButton = comfyPage.page.locator('[data-testid="delete-button"]')
    await expect(deleteButton).toBeVisible()
    await deleteButton.click({ force: true })
    await comfyPage.nextFrame()

    const newCount = await comfyPage.page.evaluate(
      () => window.app!.graph!._nodes.length
    )
    expect(newCount).toBe(initialCount - 1)
  })

  test('info button opens properties panel', async ({ comfyPage }) => {
    const nodeRef = (await comfyPage.nodeOps.getNodeRefsByTitle('KSampler'))[0]
    await selectNodeWithPan(comfyPage, nodeRef)

    const infoButton = comfyPage.page.locator('[data-testid="info-button"]')
    await expect(infoButton).toBeVisible()
    await infoButton.click({ force: true })
    await comfyPage.nextFrame()

    await expect(
      comfyPage.page.locator('[data-testid="properties-panel"]')
    ).toBeVisible()
  })

  test('convert-to-subgraph button visible with multi-select', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('default')
    await comfyPage.nextFrame()

    await comfyPage.nodeOps.selectNodes(['KSampler', 'Empty Latent Image'])
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

    await comfyPage.nodeOps.selectNodes(['KSampler', 'Empty Latent Image'])
    await comfyPage.nextFrame()

    const initialCount = await comfyPage.page.evaluate(
      () => window.app!.graph!._nodes.length
    )

    const deleteButton = comfyPage.page.locator('[data-testid="delete-button"]')
    await expect(deleteButton).toBeVisible()
    await deleteButton.click({ force: true })
    await comfyPage.nextFrame()

    const newCount = await comfyPage.page.evaluate(
      () => window.app!.graph!._nodes.length
    )
    expect(newCount).toBe(initialCount - 2)
  })
})
