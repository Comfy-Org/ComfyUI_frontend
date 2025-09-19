import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../../fixtures/ComfyPage'

test.describe('Vue Nodes - LOD', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.setup()
    await comfyPage.loadWorkflow('default')
  })

  test('should toggle LOD based on zoom threshold', async ({ comfyPage }) => {
    await comfyPage.vueNodes.waitForNodes()

    //This assumes that the intial comfyPage fixture gets created at a zoom level less than
    //the default LOD threshold and therefore checking that nodes exist within the fixture is sufficient.
    const initialNodeCount = await comfyPage.vueNodes.getNodeCount()
    expect(initialNodeCount).toBeGreaterThan(0)

    await comfyPage.zoom(120, 10)
    await comfyPage.nextFrame()

    await expect(comfyPage.canvas).toHaveScreenshot('vue-nodes-lod-active.png')

    const lodActiveState = await comfyPage.page.evaluate(() => {
      return document.querySelector('.isLOD') !== null
    })
    expect(lodActiveState).toBe(true)

    await comfyPage.zoom(-120, 10)
    await comfyPage.nextFrame()

    await expect(comfyPage.canvas).toHaveScreenshot(
      'vue-nodes-lod-inactive.png'
    )

    const lodInactiveState = await comfyPage.page.evaluate(() => {
      return document.querySelector('.isLOD') !== null
    })
    expect(lodInactiveState).toBe(false)
  })
})
