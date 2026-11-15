import { mergeTests } from '@playwright/test'

import { accessibilityFixture } from '@e2e/fixtures/accessibilityFixture'
import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import { helpCenterFixture } from '@e2e/fixtures/helpers/HelpCenterHelper'

const test = mergeTests(helpCenterFixture, accessibilityFixture)

test.describe('Panel accessibility', { tag: '@a11y' }, () => {
  test('node library sidebar', async ({ comfyPage, accessibility }) => {
    await comfyPage.menu.nodeLibraryTabV2.open()

    await accessibility.expectOnlyKnownViolations([
      'color-contrast',
      'meta-viewport',
      'tabindex'
    ])
  })

  test('model library sidebar', async ({ comfyPage, accessibility }) => {
    await comfyPage.menu.modelLibraryTab.open()

    await accessibility.expectOnlyKnownViolations([
      'color-contrast',
      'meta-viewport',
      'tabindex'
    ])
  })

  test('workflows sidebar', async ({ comfyPage, accessibility }) => {
    await comfyPage.menu.workflowsTab.open()

    await accessibility.expectOnlyKnownViolations([
      'color-contrast',
      'meta-viewport',
      'tabindex'
    ])
  })

  test('apps sidebar', async ({ comfyPage, accessibility }) => {
    await comfyPage.menu.appsTab.open()
    await expect(comfyPage.menu.appsTab.selectedTabButton).toBeVisible()

    await accessibility.expectOnlyKnownViolations([
      'color-contrast',
      'meta-viewport',
      'tabindex'
    ])
  })

  test('logs bottom panel', async ({ comfyPage, accessibility }) => {
    await comfyPage.bottomPanel.toggleLogs()
    await expect(comfyPage.bottomPanel.logs.xtermScreen).toBeVisible()

    await accessibility.expectOnlyKnownViolations([
      'aria-required-children',
      'color-contrast',
      'meta-viewport',
      'tabindex'
    ])
  })

  test('keyboard shortcuts bottom panel', async ({
    comfyPage,
    accessibility
  }) => {
    await comfyPage.bottomPanel.keyboardShortcutsButton.click()
    await expect(comfyPage.bottomPanel.shortcuts.essentialsTab).toBeVisible()

    await accessibility.expectOnlyKnownViolations([
      'aria-required-children',
      'color-contrast',
      'meta-viewport',
      'scrollable-region-focusable',
      'tabindex'
    ])
  })

  test('properties panel', async ({ comfyPage, accessibility }) => {
    await comfyPage.menu.propertiesPanel.toggleButton.click()
    await expect(comfyPage.menu.propertiesPanel.root).toBeVisible()

    await accessibility.expectOnlyKnownViolations([
      'aria-valid-attr-value',
      'color-contrast',
      'landmark-unique',
      'meta-viewport',
      'tabindex'
    ])
  })

  test('job queue panel', async ({ comfyPage, accessibility }) => {
    await comfyPage.queuePanel.open()

    await accessibility.expectOnlyKnownViolations([
      'color-contrast',
      'meta-viewport',
      'tabindex'
    ])
  })

  test('help center', async ({ helpCenter, accessibility }) => {
    await helpCenter.open()

    await accessibility.expectOnlyKnownViolations([
      'aria-required-children',
      'color-contrast',
      'meta-viewport',
      'region',
      'tabindex'
    ])
  })
})
