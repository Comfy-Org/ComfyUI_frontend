import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { load3dTest as test } from '@e2e/fixtures/helpers/Load3DFixtures'
import type { Load3DHelper } from '@e2e/tests/load3d/Load3DHelper'
import { getNodeConfig } from '@e2e/tests/load3d/Load3DHelper'

const nodeId = '1'

async function saveAndReload(comfyPage: ComfyPage): Promise<void> {
  const name = `load3d-config-${Date.now().toString(36)}`
  await comfyPage.menu.workflowsTab.open()
  await comfyPage.menu.topbar.saveWorkflow(name)
  await comfyPage.page.reload({ waitUntil: 'domcontentloaded' })
  await comfyPage.page.waitForFunction(
    () => window.app && window.app.extensionManager,
    { timeout: 30_000 }
  )
  await comfyPage.page.locator('.p-blockui-mask').waitFor({
    state: 'hidden',
    timeout: 30_000
  })
  await comfyPage.nextFrame()
  await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
  await comfyPage.settings.setSetting(
    'Comfy.Workflow.WorkflowTabsPosition',
    'Sidebar'
  )
  const tab = comfyPage.menu.workflowsTab
  await tab.open()
  await tab.getPersistedItem(name).click()
  await comfyPage.workflow.waitForWorkflowIdle(30_000)
  await comfyPage.vueNodes.waitForNodes()
}

async function openMenuAtCategory(
  load3d: Load3DHelper,
  category: string
): Promise<void> {
  await load3d.openMenu()
  await load3d.selectMenuCategory(category)
}

test.describe(
  'Load3D configuration persistence',
  { tag: ['@workflow', '@slow'] },
  () => {
    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.workflow.setupWorkflowsDirectory({})
    })

    test('scene config (grid + background color) persists across save and reload', async ({
      comfyPage,
      load3d
    }) => {
      test.setTimeout(120_000)

      await openMenuAtCategory(load3d, 'Scene')
      await load3d.clickGridToggle()
      await load3d.setBackgroundColor('#ff4400')

      await expect
        .poll(() =>
          getNodeConfig<Record<string, unknown>>(
            comfyPage.page,
            nodeId,
            'Scene Config'
          ).then((c) => c?.showGrid)
        )
        .toBe(false)

      await saveAndReload(comfyPage)

      await expect
        .poll(() =>
          getNodeConfig<Record<string, unknown>>(
            comfyPage.page,
            nodeId,
            'Scene Config'
          )
        )
        .toMatchObject({ showGrid: false, backgroundColor: '#ff4400' })
    })

    test('camera config (orthographic) persists across save and reload', async ({
      comfyPage,
      load3d
    }) => {
      test.setTimeout(120_000)

      await openMenuAtCategory(load3d, 'Camera')
      await load3d.switchCameraType()

      await expect
        .poll(() =>
          getNodeConfig<Record<string, unknown>>(
            comfyPage.page,
            nodeId,
            'Camera Config'
          ).then((c) => c?.cameraType)
        )
        .toBe('orthographic')

      await saveAndReload(comfyPage)

      await expect
        .poll(() =>
          getNodeConfig<Record<string, unknown>>(
            comfyPage.page,
            nodeId,
            'Camera Config'
          ).then((c) => c?.cameraType)
        )
        .toBe('orthographic')
    })

    test('model config (wireframe material) persists across save and reload', async ({
      comfyPage,
      load3d
    }) => {
      test.setTimeout(120_000)

      await openMenuAtCategory(load3d, 'Model')
      await load3d.selectMaterialMode('Wireframe')

      await expect
        .poll(() =>
          getNodeConfig<Record<string, unknown>>(
            comfyPage.page,
            nodeId,
            'Model Config'
          ).then((c) => c?.materialMode)
        )
        .toBe('wireframe')

      await saveAndReload(comfyPage)

      await expect
        .poll(() =>
          getNodeConfig<Record<string, unknown>>(
            comfyPage.page,
            nodeId,
            'Model Config'
          ).then((c) => c?.materialMode)
        )
        .toBe('wireframe')
    })
  }
)
