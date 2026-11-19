import { mergeTests } from '@playwright/test'

import { accessibilityFixture } from '@e2e/fixtures/accessibilityFixture'
import {
  comfyExpect as expect,
  comfyPageFixture
} from '@e2e/fixtures/ComfyPage'

const test = mergeTests(comfyPageFixture, accessibilityFixture)

test.describe('Menu accessibility', { tag: '@a11y' }, () => {
  test('topbar menu', async ({ comfyPage, accessibility }) => {
    await comfyPage.menu.topbar.openTopbarMenu()

    await accessibility.expectOnlyKnownViolations([
      'aria-hidden-focus',
      'color-contrast',
      'meta-viewport',
      'nested-interactive',
      'page-has-heading-one',
      'region'
    ])
  })

  test('canvas context menu', async ({ comfyPage, accessibility }) => {
    await comfyPage.canvasOps.rightClick(200, 200)
    await expect(comfyPage.contextMenu.litegraphContextMenu).toBeVisible()

    await accessibility.expectOnlyKnownViolations([
      'aria-required-parent',
      'color-contrast',
      'meta-viewport',
      'region',
      'tabindex'
    ])
  })

  test(
    'Vue node context menu',
    { tag: '@vue-nodes' },
    async ({ comfyPage, accessibility }) => {
      await comfyPage.contextMenu.openForVueNode(
        comfyPage.vueNodes.getNodeByTitle('KSampler').locator('.lg-node-header')
      )

      await accessibility.expectOnlyKnownViolations([
        'color-contrast',
        'label-content-name-mismatch',
        'meta-viewport',
        'region',
        'tabindex'
      ])
    }
  )
})
