import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import { load3dTest as test } from '@e2e/fixtures/helpers/Load3DFixtures'
import { toNodeId } from '@/types/nodeId'

const getGizmoConfig = (page: Page) =>
  page.evaluate((nodeId) => {
    const n = window.app!.graph.getNodeById(nodeId)
    const modelConfig = n?.properties['Model Config'] as
      | { gizmo?: { enabled: boolean; mode: string } }
      | undefined
    return modelConfig?.gizmo
  }, toNodeId(1))

test.describe('Load3D Gizmo Controls', () => {
  test(
    'Gizmo category appears in the controls menu',
    { tag: '@smoke' },
    async ({ load3d }) => {
      await load3d.openMenu()

      await expect(load3d.getMenuCategory('Gizmo')).toBeVisible()
    }
  )

  test(
    'Selecting Gizmo category shows the toggle button',
    { tag: '@smoke' },
    async ({ load3d }) => {
      await load3d.openGizmoCategory()

      await expect(load3d.gizmoToggleButton).toBeVisible()
      await expect(load3d.gizmoModeMenuButton).toBeHidden()
    }
  )

  test(
    'Toggling gizmo reveals the mode menu and updates node state',
    { tag: '@smoke' },
    async ({ comfyPage, load3d }) => {
      await load3d.openGizmoCategory()
      await load3d.gizmoToggleButton.click()

      await expect(load3d.gizmoModeMenuButton).toBeVisible()
      await expect
        .poll(() => getGizmoConfig(comfyPage.page).then((g) => g?.enabled))
        .toBe(true)

      await load3d.gizmoToggleButton.click()
      await expect(load3d.gizmoModeMenuButton).toBeHidden()
      await expect
        .poll(() => getGizmoConfig(comfyPage.page).then((g) => g?.enabled))
        .toBe(false)
    }
  )

  test(
    'Selecting a gizmo mode updates node state',
    { tag: '@smoke' },
    async ({ comfyPage, load3d }) => {
      await load3d.openGizmoCategory()
      await load3d.gizmoToggleButton.click()

      await load3d.selectGizmoMode('Rotate')
      await expect
        .poll(() => getGizmoConfig(comfyPage.page).then((g) => g?.mode))
        .toBe('rotate')

      await load3d.selectGizmoMode('Scale')
      await expect
        .poll(() => getGizmoConfig(comfyPage.page).then((g) => g?.mode))
        .toBe('scale')

      await load3d.selectGizmoMode('Translate')
      await expect
        .poll(() => getGizmoConfig(comfyPage.page).then((g) => g?.mode))
        .toBe('translate')
    }
  )
})
