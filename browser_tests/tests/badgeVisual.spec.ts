import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.describe('Badge migration', { tag: '@ui' }, () => {
  test.describe('SearchFilterChip', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting(
        'Comfy.NodeSearchBoxImpl',
        'v1 (legacy)'
      )
      await comfyPage.toast.closeToasts()
    })

    test('Filter chip remove button removes the chip', async ({
      comfyPage
    }) => {
      await comfyPage.canvasOps.doubleClick()
      await expect(comfyPage.searchBox.input).toBeVisible()
      await comfyPage.searchBox.addFilter('MODEL', 'Input Type')
      await expect(comfyPage.searchBox.filterChips).toHaveCount(1)

      await comfyPage.searchBox.removeFilter(0)
      await expect(comfyPage.searchBox.filterChips).toHaveCount(0)
    })
  })

  test.describe('Node library tree badge', () => {
    test('Folder shows node count badge', async ({ comfyPage }) => {
      await comfyPage.toast.closeToasts()

      const sidebarButton = comfyPage.page.getByRole('button', {
        name: 'Node Library'
      })
      await sidebarButton.click()

      const sidebar = comfyPage.page.getByRole('complementary', {
        name: 'Sidebar'
      })
      await sidebar
        .getByRole('treeitem')
        .first()
        .waitFor({ state: 'visible', timeout: 10000 })

      const badges = sidebar.locator('[data-testid="node-tree-folder"] span')
      await expect(badges.first()).toBeVisible()
    })
  })
})
