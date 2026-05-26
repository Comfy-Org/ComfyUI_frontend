import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { DeprecationWarningsSidebarTab } from '@e2e/fixtures/components/SidebarTab'

test.describe('Deprecation warnings sidebar', { tag: '@ui' }, () => {
  test.describe('with DevMode disabled', () => {
    test.use({ initialSettings: { 'Comfy.DevMode': false } })

    test('does not render the sidebar icon', async ({ comfyPage }) => {
      const tab = new DeprecationWarningsSidebarTab(comfyPage.page)
      await expect(tab.tabButton).toHaveCount(0)
    })
  })

  test.describe('with DevMode enabled', () => {
    test.use({ initialSettings: { 'Comfy.DevMode': true } })

    test('records a new deprecation, shows it in the panel, dedupes repeats', async ({
      comfyPage
    }) => {
      const tab = new DeprecationWarningsSidebarTab(comfyPage.page)
      await expect(tab.tabButton).toBeVisible()

      const uniqueMessage = `e2e-${Date.now()} is deprecated.`

      await tab.emitDeprecation(uniqueMessage)
      await tab.open()
      await expect(tab.panel).toBeVisible()

      const row = tab.rowFor(uniqueMessage)
      await expect(row).toBeVisible()

      await tab.emitDeprecation(uniqueMessage)
      await expect(row.getByTestId('deprecation-warning-badge')).toHaveText('2')
      await expect(tab.rowFor(uniqueMessage)).toHaveCount(1)
    })

    test('opening the panel clears the unseen badge', async ({ comfyPage }) => {
      const tab = new DeprecationWarningsSidebarTab(comfyPage.page)
      await expect(tab.tabButton).toBeVisible()

      // Mark any pre-existing warnings as seen.
      await tab.open()
      await expect(tab.panel).toBeVisible()
      await tab.close()
      await expect(tab.panel).toBeHidden()

      await expect(tab.badge).toHaveCount(0)

      await tab.emitDeprecation(`e2e-badge-${Date.now()} is deprecated.`)
      await expect(tab.badge).toHaveText('1')

      await tab.open()
      await expect(tab.badge).toHaveCount(0)
    })

    test('clear all empties the panel and shows the empty state', async ({
      comfyPage
    }) => {
      const tab = new DeprecationWarningsSidebarTab(comfyPage.page)
      await tab.open()
      await expect(tab.panel).toBeVisible()

      const uniqueMessage = `e2e-clearAll-${Date.now()} is deprecated.`
      await tab.emitDeprecation(uniqueMessage)
      await expect(tab.rowFor(uniqueMessage)).toBeVisible()

      // Tool-buttons slot is hover/focus-gated; hover the panel to reveal it.
      await tab.panel.hover()
      await tab.clearAllButton.click()

      await expect(tab.list).toHaveCount(0)
      await expect(tab.emptyState).toBeVisible()
      await expect(tab.clearAllButton).toHaveCount(0)
    })

    test('clamps the toolbar badge at "9+" when many unseen warnings pile up', async ({
      comfyPage
    }) => {
      const tab = new DeprecationWarningsSidebarTab(comfyPage.page)
      await tab.open()
      await expect(tab.panel).toBeVisible()
      await tab.close()
      await expect(tab.panel).toBeHidden()

      const stamp = Date.now()
      for (let i = 0; i < 12; i++) {
        await tab.emitDeprecation(`e2e-${stamp}-${i} is deprecated.`)
      }

      await expect(tab.badge).toHaveText('9+')
    })
  })
})
