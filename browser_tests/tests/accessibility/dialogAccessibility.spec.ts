import type { GetExtensionsResponse } from '@comfyorg/ingest-types'
import { mergeTests } from '@playwright/test'

import { accessibilityFixture } from '@e2e/fixtures/accessibilityFixture'
import {
  comfyExpect as expect,
  comfyPageFixture
} from '@e2e/fixtures/ComfyPage'
import {
  SHORTCUT_PACK_SCRIPT,
  shortcutPackSource
} from '@e2e/fixtures/data/shortcutPackFixture'

const test = mergeTests(comfyPageFixture, accessibilityFixture)

test.describe('Dialog accessibility', { tag: '@a11y' }, () => {
  test('settings dialog', async ({ comfyPage, accessibility }) => {
    await comfyPage.settingDialog.open()

    await accessibility.expectOnlyKnownViolations([
      'aria-input-field-name',
      'color-contrast',
      'landmark-no-duplicate-main',
      'landmark-unique',
      'meta-viewport',
      'scrollable-region-focusable'
    ])
  })

  test('settings dialog Appearance panel', async ({
    comfyPage,
    accessibility
  }) => {
    await comfyPage.settingDialog.open()
    await comfyPage.settingDialog.category('Appearance').click()
    await expect(
      comfyPage.settingDialog.contentArea.getByText('Color Palette')
    ).toBeVisible()

    await accessibility.expectOnlyKnownViolations([
      'aria-input-field-name',
      'color-contrast',
      'landmark-no-duplicate-main',
      'landmark-unique',
      'meta-viewport',
      'scrollable-region-focusable'
    ])
  })

  test('settings dialog Keybinding panel', async ({
    comfyPage,
    accessibility
  }) => {
    await comfyPage.settingDialog.open()
    await comfyPage.settingDialog.category('Keybinding').click()
    await expect(comfyPage.settingDialog.keybindingPanel.root).toBeVisible()

    await accessibility.expectOnlyKnownViolations([
      'aria-conditional-attr',
      'button-name',
      'color-contrast',
      'landmark-no-duplicate-main',
      'landmark-unique',
      'meta-viewport',
      'scrollable-region-focusable'
    ])
  })

  test.describe('settings dialog Extension panel', () => {
    test.beforeEach(async ({ page }) => {
      await page.route('**/extensions', (route) =>
        route.fulfill({
          json: [SHORTCUT_PACK_SCRIPT] satisfies GetExtensionsResponse
        })
      )
      await page.route(`**${SHORTCUT_PACK_SCRIPT}*`, (route) =>
        route.fulfill({
          contentType: 'text/javascript',
          body: shortcutPackSource
        })
      )
    })

    test('with an installed extension pack', async ({
      comfyPage,
      accessibility
    }) => {
      await comfyPage.settingDialog.open()
      await comfyPage.settingDialog.category('Extension').click()
      await expect(
        comfyPage.settingDialog.contentArea.getByRole('switch', {
          name: 'Extension folder shortcut-pack'
        })
      ).toBeVisible()
      await expect(comfyPage.settingDialog.extensionActionsButton).toBeVisible()

      await accessibility.expectOnlyKnownViolations([
        'color-contrast',
        'empty-table-header',
        'landmark-no-duplicate-main',
        'landmark-unique',
        'meta-viewport',
        'scrollable-region-focusable'
      ])
    })
  })

  test('settings dialog About panel', async ({ comfyPage, accessibility }) => {
    await comfyPage.settingDialog.open()
    await comfyPage.settingDialog.goToAboutPanel()

    await accessibility.expectOnlyKnownViolations([
      'color-contrast',
      'landmark-no-duplicate-main',
      'landmark-unique',
      'meta-viewport',
      'scrollable-region-focusable'
    ])
  })

  test('templates dialog', async ({ comfyPage, accessibility }) => {
    await comfyPage.command.executeCommand('Comfy.BrowseTemplates')
    await comfyPage.templates.expectMinimumCardCount(1)

    await accessibility.expectOnlyKnownViolations([
      'color-contrast',
      'label-content-name-mismatch',
      'landmark-no-duplicate-main',
      'landmark-unique',
      'meta-viewport',
      'scrollable-region-focusable'
    ])
  })

  test('node search', async ({ comfyPage, accessibility }) => {
    await comfyPage.searchBoxV2.open()

    await accessibility.expectOnlyKnownViolations([
      'color-contrast',
      'meta-viewport'
    ])
  })

  test.describe('light theme', () => {
    test.use({ initialSettings: { 'Comfy.ColorPalette': 'light' } })

    test('settings dialog', async ({ comfyPage, accessibility }) => {
      await comfyPage.settingDialog.open()

      await accessibility.expectOnlyKnownViolations([
        'aria-input-field-name',
        'landmark-no-duplicate-main',
        'landmark-unique',
        'meta-viewport',
        'scrollable-region-focusable'
      ])
    })
  })
})
