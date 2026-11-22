import { mergeTests } from '@playwright/test'

import { accessibilityFixture } from '@e2e/fixtures/accessibilityFixture'
import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import { helpCenterFixture } from '@e2e/fixtures/helpers/HelpCenterHelper'

const test = mergeTests(helpCenterFixture, accessibilityFixture)

test.describe('Panel accessibility', { tag: '@a11y' }, () => {
  test('node library sidebar', async ({ comfyPage, accessibility }) => {
    await comfyPage.menu.nodeLibraryTabV2.open()

    await accessibility.expectOnlyKnownViolations({
      'color-contrast': 1,
      'meta-viewport': 1,
      tabindex: 1
    })
  })

  test('model library sidebar', async ({ comfyPage, accessibility }) => {
    await comfyPage.menu.modelLibraryTab.open()
    await expect(
      comfyPage.menu.modelLibraryTab.getFolderByLabel('checkpoints')
    ).toBeVisible()

    await accessibility.expectOnlyKnownViolations({
      'color-contrast': 1,
      'meta-viewport': 1,
      tabindex: 1
    })
  })

  test('workflows sidebar', async ({ comfyPage, accessibility }) => {
    await comfyPage.menu.workflowsTab.open()

    await accessibility.expectOnlyKnownViolations({
      'color-contrast': 1,
      'meta-viewport': 1,
      tabindex: 1
    })
  })

  test('apps sidebar', async ({ comfyPage, accessibility }) => {
    await comfyPage.menu.appsTab.open()
    await expect(comfyPage.menu.appsTab.selectedTabButton).toBeVisible()

    await accessibility.expectOnlyKnownViolations({
      'color-contrast': 2,
      'meta-viewport': 1,
      tabindex: 1
    })
  })

  test('logs bottom panel', async ({ comfyPage, accessibility }) => {
    await comfyPage.bottomPanel.toggleLogs()
    await expect(comfyPage.bottomPanel.logs.xtermScreen).toBeVisible()

    await accessibility.expectOnlyKnownViolations({
      'aria-required-children': 1,
      'color-contrast': 1,
      'meta-viewport': 1,
      tabindex: 1
    })
  })

  test('keyboard shortcuts bottom panel', async ({
    comfyPage,
    accessibility
  }) => {
    await comfyPage.bottomPanel.keyboardShortcutsButton.click()
    await expect(comfyPage.bottomPanel.shortcuts.essentialsTab).toBeVisible()

    await accessibility.expectOnlyKnownViolations({
      'aria-required-children': 1,
      'color-contrast': 1,
      'meta-viewport': 1,
      'scrollable-region-focusable': 1,
      tabindex: 1
    })
  })

  test('properties panel', async ({ comfyPage, accessibility }) => {
    await comfyPage.menu.propertiesPanel.toggleButton.click()
    await expect(comfyPage.menu.propertiesPanel.root).toBeVisible()

    await accessibility.expectOnlyKnownViolations({
      'aria-valid-attr-value': 1,
      'color-contrast': 1,
      'landmark-unique': 1,
      'meta-viewport': 1,
      tabindex: 1
    })
  })

  test('job queue panel', async ({ comfyPage, accessibility }) => {
    await comfyPage.queuePanel.open()

    await accessibility.expectOnlyKnownViolations({
      'color-contrast': 1,
      'meta-viewport': 1,
      tabindex: 1
    })
  })

  test('help center', async ({ helpCenter, accessibility }) => {
    await helpCenter.open()

    await accessibility.expectOnlyKnownViolations({
      'aria-required-children': 1,
      'color-contrast': 1,
      'meta-viewport': 1,
      region: 1,
      tabindex: 1
    })
  })
})
