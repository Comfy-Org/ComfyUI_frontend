import type { Locator } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

/**
 * Regression coverage for the Chrome-only `:focus-visible` outline that
 * appears on a selected Vue node when the Shift key is held.
 *
 * `LGraphNode.vue` has `tabindex="0"` on its root, so clicking a node gives
 * the `<div>` DOM focus. PR #9360 then replaced the CSS `outline` selection
 * indicator with a layered border overlay. Combined, Chromium's
 * `:focus-visible` heuristic — which promotes a focused element to
 * `:focus-visible` on a bare Shift keypress — paints a second, browser-default
 * focus ring on top of the selection overlay. WebKit/Safari excludes
 * modifier-only keypresses from the heuristic (WebKit bug #225075 / r276698),
 * so this is Chrome-only.
 *
 * Two complementary tests:
 *
 * 1. The screenshot test runs unconditionally and captures the current
 *    rendered state at the trigger point so unrelated visual regressions are
 *    diffed against a known baseline.
 * 2. The behavioral test asserts the *intended* post-fix state (no
 *    `:focus-visible`, no UA outline) and is annotated `test.fail()` only on
 *    Chromium (the non-Chromium engines do not exhibit the bug, so the
 *    annotation would otherwise produce an unexpected-pass failure on those
 *    projects). The Chromium run is expected to fail until the bug is fixed;
 *    when the fix lands the test will start passing, which Playwright
 *    surfaces as a hard failure of the `test.fail()` annotation, prompting
 *    removal of the annotation **and** regeneration of the screenshot
 *    baseline.
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
        const node = await selectCheckpointNode(comfyPage)

        await comfyPage.page.keyboard.down('Shift')
        try {
          await comfyPage.expectScreenshot(
            node,
            'vue-node-shift-focus-outline.png'
          )
        } finally {
          await comfyPage.page.keyboard.up('Shift')
        }
      }
    )

    test('does not promote selected node to :focus-visible when Shift is held (Chrome-only regression)', async ({
      comfyPage,
      browserName
    }) => {
      test.fail(
        browserName === 'chromium',
        'Chromium promotes a focused element to :focus-visible on a bare Shift keypress; WebKit/Firefox do not. Remove this annotation when the underlying UI bug is fixed.'
      )

      const node = await selectCheckpointNode(comfyPage)
      await expect
        .poll(() =>
          node.evaluate((el: HTMLElement) => el.matches(':focus-visible'))
        )
        .toBe(false)

      await comfyPage.page.keyboard.down('Shift')
      try {
        await expect
          .poll(() =>
            node.evaluate((el: HTMLElement) => ({
              matchesFocusVisible: el.matches(':focus-visible'),
              outlineStyle: getComputedStyle(el).outlineStyle
            }))
          )
          .toEqual({ matchesFocusVisible: false, outlineStyle: 'none' })
      } finally {
        await comfyPage.page.keyboard.up('Shift')
      }
    })
  }
)
