import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import { load3dTest as test } from '@e2e/fixtures/helpers/Load3DFixtures'

const getGizmoConfig = (page: Page) =>
  page.evaluate(() => {
    const n = window.app!.graph.getNodeById(1)
    const modelConfig = n?.properties?.['Model Config'] as
      | { gizmo?: { enabled: boolean; mode: string } }
      | undefined
    return modelConfig?.gizmo
  })

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
      await expect(load3d.gizmoTranslateButton).toBeHidden()
      await expect(load3d.gizmoRotateButton).toBeHidden()
      await expect(load3d.gizmoScaleButton).toBeHidden()
      await expect(load3d.gizmoResetButton).toBeHidden()
    }
  )

  test(
    'Toggling gizmo reveals mode buttons and updates node state',
    { tag: '@smoke' },
    async ({ comfyPage, load3d }) => {
      await load3d.openGizmoCategory()
      await load3d.gizmoToggleButton.click()

      await expect(load3d.gizmoTranslateButton).toBeVisible()
      await expect(load3d.gizmoRotateButton).toBeVisible()
      await expect(load3d.gizmoScaleButton).toBeVisible()
      await expect(load3d.gizmoResetButton).toBeVisible()

      await expect
        .poll(() => getGizmoConfig(comfyPage.page).then((g) => g?.enabled))
        .toBe(true)

      await load3d.gizmoToggleButton.click()
      await expect(load3d.gizmoTranslateButton).toBeHidden()
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

      await load3d.gizmoRotateButton.click()
      await expect
        .poll(() => getGizmoConfig(comfyPage.page).then((g) => g?.mode))
        .toBe('rotate')

      await load3d.gizmoScaleButton.click()
      await expect
        .poll(() => getGizmoConfig(comfyPage.page).then((g) => g?.mode))
        .toBe('scale')

      await load3d.gizmoTranslateButton.click()
      await expect
        .poll(() => getGizmoConfig(comfyPage.page).then((g) => g?.mode))
        .toBe('translate')
    }
  )
})
