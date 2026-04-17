import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import {
  load3dTest,
  load3dVueEnabledTest
} from '@e2e/fixtures/helpers/Load3DFixtures'
import { getNodeConfig } from '@e2e/tests/load3d/Load3DHelper'

async function addLoad3dNode(page: Page): Promise<string> {
  const nodeId = await page.evaluate(() => {
    const node = window.app!.graph.add(
      window.LiteGraph!.createNode('Load3D', undefined, {})
    )
    return String(node!.id)
  })
  await page.waitForFunction(
    (id) => document.querySelector(`[data-node-id="${id}"]`) !== null,
    nodeId
  )
  return nodeId
}

load3dVueEnabledTest.describe(
  'Load3D settings integration',
  { tag: '@ui' },
  () => {
    load3dVueEnabledTest(
      'default grid visibility is applied to new nodes from setting',
      async ({ comfyPage }) => {
        await comfyPage.settings.setSetting('Comfy.Load3D.ShowGrid', false)
        const nodeId = await addLoad3dNode(comfyPage.page)
        await comfyPage.nextFrame()

        await expect
          .poll(() =>
            getNodeConfig<Record<string, unknown>>(
              comfyPage.page,
              nodeId,
              'Scene Config'
            ).then((c) => c?.showGrid)
          )
          .toBe(false)
      }
    )

    load3dVueEnabledTest(
      'default background color is applied to new nodes from setting',
      async ({ comfyPage }) => {
        await comfyPage.settings.setSetting(
          'Comfy.Load3D.BackgroundColor',
          'ff4400'
        )
        const nodeId = await addLoad3dNode(comfyPage.page)
        await comfyPage.nextFrame()

        await expect
          .poll(() =>
            getNodeConfig<Record<string, unknown>>(
              comfyPage.page,
              nodeId,
              'Scene Config'
            ).then((c) => c?.backgroundColor)
          )
          .toBe('#ff4400')
      }
    )

    load3dVueEnabledTest(
      'default camera type is applied to new nodes from setting',
      async ({ comfyPage }) => {
        await comfyPage.settings.setSetting(
          'Comfy.Load3D.CameraType',
          'orthographic'
        )
        const nodeId = await addLoad3dNode(comfyPage.page)
        await comfyPage.nextFrame()

        await expect
          .poll(() =>
            getNodeConfig<Record<string, unknown>>(
              comfyPage.page,
              nodeId,
              'Camera Config'
            ).then((c) => c?.cameraType)
          )
          .toBe('orthographic')
      }
    )
  }
)

load3dTest.describe(
  '3D Viewer button visibility controlled by setting',
  { tag: '@ui' },
  () => {
    load3dTest(
      'open viewer button visible when 3DViewerEnable is true',
      async ({ comfyPage, load3d }) => {
        await comfyPage.settings.setSetting('Comfy.Load3D.3DViewerEnable', true)
        await expect(load3d.openViewerButton).toBeVisible()
      }
    )

    load3dTest(
      'open viewer button hidden when 3DViewerEnable is false',
      async ({ comfyPage, load3d }) => {
        await comfyPage.settings.setSetting(
          'Comfy.Load3D.3DViewerEnable',
          false
        )
        await expect(load3d.openViewerButton).toBeHidden()
      }
    )
  }
)
