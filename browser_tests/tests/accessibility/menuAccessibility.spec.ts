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

    await accessibility.expectOnlyKnownViolations({
      'aria-hidden-focus': 6,
      'color-contrast': 1,
      'meta-viewport': 1,
      'nested-interactive': 1,
      'page-has-heading-one': 1,
      region: 1
    })
  })

  test('canvas context menu', async ({ comfyPage, accessibility }) => {
    await comfyPage.canvasOps.rightClick(200, 200)
    await expect(comfyPage.contextMenu.litegraphContextMenu).toBeVisible()

    await accessibility.expectOnlyKnownViolations({
      'aria-required-parent': 5,
      'color-contrast': 1,
      'meta-viewport': 1,
      region: 1,
      tabindex: 1
    })
  })

  test(
    'Vue node context menu',
    { tag: '@vue-nodes' },
    async ({ comfyPage, accessibility }) => {
      await comfyPage.contextMenu.openForVueNode(
        comfyPage.vueNodes.getNodeByTitle('KSampler').locator('.lg-node-header')
      )

      await accessibility.expectOnlyKnownViolations({
        'color-contrast': 5,
        'label-content-name-mismatch': 4,
        'meta-viewport': 1,
        region: 1,
        tabindex: 1
      })
    }
  )
})
