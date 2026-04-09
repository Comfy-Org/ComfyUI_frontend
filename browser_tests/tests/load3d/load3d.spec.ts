import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { Load3DHelper } from '@e2e/tests/load3d/Load3DHelper'

test.describe('Load3D', () => {
  let load3d: Load3DHelper

  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.workflow.loadWorkflow('3d/load3d_node')
    await comfyPage.vueNodes.waitForNodes()

    const node = comfyPage.vueNodes.getNodeLocator('1')
    load3d = new Load3DHelper(node)
  })

  test(
    'Renders canvas with upload buttons and controls menu',
    { tag: ['@smoke', '@screenshot'] },
    async () => {
      await expect(load3d.node).toBeVisible()

      await expect(load3d.canvas).toBeVisible()

      await expect
        .poll(async () => {
          const b = await load3d.canvas.boundingBox()
          return b?.width ?? 0
        })
        .toBeGreaterThan(0)
      await expect
        .poll(async () => {
          const b = await load3d.canvas.boundingBox()
          return b?.height ?? 0
        })
        .toBeGreaterThan(0)

      await expect(load3d.getUploadButton('upload 3d model')).toBeVisible()
      await expect(
        load3d.getUploadButton('upload extra resources')
      ).toBeVisible()
      await expect(load3d.getUploadButton('clear')).toBeVisible()

      await expect(load3d.menuButton).toBeVisible()

      await expect(load3d.node).toHaveScreenshot('load3d-empty-node.png', {
        maxDiffPixelRatio: 0.05
      })
    }
  )

  test(
    'Controls menu opens and shows all categories',
    { tag: ['@smoke', '@screenshot'] },
    async () => {
      await load3d.openMenu()

      await expect(load3d.getMenuCategory('Scene')).toBeVisible()
      await expect(load3d.getMenuCategory('Model')).toBeVisible()
      await expect(load3d.getMenuCategory('Camera')).toBeVisible()
      await expect(load3d.getMenuCategory('Light')).toBeVisible()
      await expect(load3d.getMenuCategory('Export')).toBeVisible()

      await expect(load3d.node).toHaveScreenshot(
        'load3d-controls-menu-open.png',
        { maxDiffPixelRatio: 0.05 }
      )
    }
  )

  test(
    'Changing background color updates the scene',
    { tag: ['@smoke', '@screenshot'] },
    async ({ comfyPage }) => {
      await load3d.setBackgroundColor('#cc3333')
      await comfyPage.nextFrame()

      await expect
        .poll(
          () =>
            comfyPage.page.evaluate(() => {
              const n = window.app!.graph.getNodeById(1)
              const config = n?.properties?.['Scene Config'] as
                | Record<string, string>
                | undefined
              return config?.backgroundColor
            }),
          { timeout: 3000 }
        )
        .toBe('#cc3333')

      await expect(load3d.node).toHaveScreenshot('load3d-red-background.png', {
        maxDiffPixelRatio: 0.05
      })
    }
  )

  test(
    'Recording controls are visible for Load3D',
    { tag: '@smoke' },
    async () => {
      await expect(load3d.recordingButton).toBeVisible()
    }
  )
})
