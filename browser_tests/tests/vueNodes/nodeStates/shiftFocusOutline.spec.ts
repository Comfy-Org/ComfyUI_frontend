import type { Locator } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

/**
 * Regression for a Chrome-only UA focus outline that appears on a selected
 * Vue node when the Shift key is held (the LGraphNode root has `tabindex="0"`).
 *
 * The behavioral test below is `test.fail()` only on Chromium and asserts the
 * intended post-fix state. When the bug is fixed the assertion will pass,
 * Playwright will report the unexpected pass, and that is the signal to drop
 * the `test.fail` annotation and regenerate the screenshot baseline.
 */
async function selectCheckpointNode(comfyPage: ComfyPage): Promise<Locator> {
  const node = comfyPage.vueNodes.getNodeByTitle('Load Checkpoint').first()
  await node.locator('.lg-node-header').click()
  await expect(node).toHaveClass(/outline-node-component-outline/)
  await expect
    .poll(() => node.evaluate((el) => document.activeElement === el))
    .toBe(true)
  return node
}

test.describe(
  'Vue Node Shift focus-visible outline',
  { tag: ['@vue-nodes'] },
  () => {
    test(
      'snapshots node appearance when Shift is held on a selected node',
      { tag: '@screenshot' },
      async ({ comfyPage }) => {
        await selectCheckpointNode(comfyPage)

        await comfyPage.page.keyboard.down('Shift')
        try {
          await comfyPage.expectScreenshot(
            comfyPage.canvas,
            'vue-node-shift-focus-outline.png'
          )
        } finally {
          await comfyPage.page.keyboard.up('Shift')
        }
      }
    )

    test('does not paint an extra focus outline on a selected node when Shift is held (Chrome-only regression)', async ({
      comfyPage,
      browserName
    }) => {
      test.fail(
        browserName === 'chromium',
        'Chromium paints a UA focus outline on a focused element after a bare Shift keypress; WebKit/Firefox do not. Remove this annotation when the underlying UI bug is fixed.'
      )

      const node = await selectCheckpointNode(comfyPage)
      await expect
        .poll(() =>
          node.evaluate((el: HTMLElement) => getComputedStyle(el).outlineStyle)
        )
        .toBe('none')

      await comfyPage.page.keyboard.down('Shift')
      try {
        await expect
          .poll(() =>
            node.evaluate(
              (el: HTMLElement) => getComputedStyle(el).outlineStyle
            )
          )
          .toBe('none')
      } finally {
        await comfyPage.page.keyboard.up('Shift')
      }
    })
  }
)
