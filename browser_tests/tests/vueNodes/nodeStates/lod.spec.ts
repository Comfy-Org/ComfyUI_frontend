import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../../../fixtures/ComfyPage'

test.beforeEach(async ({ comfyPage }) => {
  await comfyPage.setSetting('Comfy.UseNewMenu', 'Disabled')
})

test.describe('Vue Nodes - LOD', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.setup()
    await comfyPage.loadWorkflow('default')
  })

  test('should toggle LOD based on zoom threshold', async ({ comfyPage }) => {
    await comfyPage.vueNodes.waitForNodes()

    const initialNodeCount = await comfyPage.vueNodes.getNodeCount()
    expect(initialNodeCount).toBeGreaterThan(0)

    await expect(comfyPage.canvas).toHaveScreenshot('vue-nodes-default.png')

    const vueNodesContainer = comfyPage.vueNodes.nodes
    const textboxesInNodes = vueNodesContainer.getByRole('textbox')
    const buttonsInNodes = vueNodesContainer.getByRole('button')

    await expect(textboxesInNodes.first()).toBeVisible()
    await expect(buttonsInNodes.first()).toBeVisible()

    await comfyPage.zoom(120, 10)
    await comfyPage.nextFrame()

    await expect(comfyPage.canvas).toHaveScreenshot('vue-nodes-lod-active.png')

    await expect(textboxesInNodes.first()).toBeHidden()
    await expect(buttonsInNodes.first()).toBeHidden()

    await comfyPage.zoom(-120, 10)
    await comfyPage.nextFrame()

    await expect(comfyPage.canvas).toHaveScreenshot(
      'vue-nodes-lod-inactive.png'
    )
    await expect(textboxesInNodes.first()).toBeVisible()
    await expect(buttonsInNodes.first()).toBeVisible()
  })
})
