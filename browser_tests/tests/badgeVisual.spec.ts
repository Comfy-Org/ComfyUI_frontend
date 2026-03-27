import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.describe(
  'Badge visual regression',
  { tag: ['@screenshot', '@ui'] },
  () => {
    test.describe('SearchFilterChip badge', () => {
      test.beforeEach(async ({ comfyPage }) => {
        await comfyPage.settings.setSetting(
          'Comfy.NodeSearchBoxImpl',
          'v1 (legacy)'
        )
        await comfyPage.toast.closeToasts()
      })

      test('Single filter chip renders correctly', async ({ comfyPage }) => {
        await comfyPage.canvasOps.doubleClick()
        await comfyPage.searchBox.addFilter('CONDITIONING', 'Input Type')

        const searchContainer = comfyPage.page.locator(
          '.comfy-vue-node-search-container'
        )
        await expect(searchContainer).toHaveScreenshot(
          'filter-chip-conditioning.png'
        )
      })

      test('Multiple filter chips render correctly', async ({ comfyPage }) => {
        await comfyPage.canvasOps.doubleClick()
        await comfyPage.searchBox.addFilter('MODEL', 'Input Type')
        await comfyPage.searchBox.addFilter('CLIP', 'Output Type')

        const searchContainer = comfyPage.page.locator(
          '.comfy-vue-node-search-container'
        )
        await expect(searchContainer).toHaveScreenshot(
          'filter-chips-multiple.png'
        )
      })
    })

    test.describe('Node library tree badge', () => {
      test('Folder node count badge renders correctly', async ({
        comfyPage
      }) => {
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

        await expect(sidebar).toHaveScreenshot('node-library-tree-badges.png')
      })
    })
  }
)
