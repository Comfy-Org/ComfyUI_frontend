import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import {
  expectDomWidgetAlignedAfterTransformChange,
  expectRelativeOffsetUnchanged,
  snapshotDomWidget,
  snapshotRelativeOffset
} from '@e2e/fixtures/utils/domWidgetAlignment'

// NOTE: These tests currently always pass in Chromium/CI. The regression
// this suite guards against (DESK2-146: a stale DOM widget overlay left
// behind after a native Electron window resize) has been confirmed to
// reproduce only in ComfyUI Desktop (Electron), not in a browser tab -- so
// nothing here will turn red if that underlying Electron bug resurfaces.
// They still earn their keep as regression coverage for the browser-reachable
// code paths involved (Classic mode DOM widget resize sync, Vue Nodes resize
// sync) in case a future change breaks those specifically, and as a record of
// what was ruled out during that investigation.

const LARGE_VIEWPORT = { width: 1920, height: 1080 }
const SMALL_VIEWPORT = { width: 900, height: 600 }

const RAPID_RESIZE_STEPS = [
  { width: 1000, height: 650 },
  { width: 1400, height: 950 },
  { width: 1100, height: 700 },
  { width: 1600, height: 900 },
  { width: 1300, height: 800 },
  // Deliberately end on LARGE_VIEWPORT so the final state matches the
  // viewport used by the single-resize tests above.
  { width: 1920, height: 1080 }
]

test.describe(
  'DOM widget alignment across viewport resize',
  { tag: ['@widget', '@canvas'] },
  () => {
    test('single-node DOM widget stays aligned with its node after one viewport resize', async ({
      comfyPage
    }) => {
      await comfyPage.page.setViewportSize(SMALL_VIEWPORT)
      await comfyPage.workflow.loadWorkflow('widgets/multiline_single_node')

      const widget = comfyPage.page.locator('.dom-widget')
      await expect(widget).toBeVisible()

      const before = await snapshotDomWidget(comfyPage.page, widget)

      await comfyPage.page.setViewportSize(LARGE_VIEWPORT)
      await comfyPage.nextFrame()

      await expectDomWidgetAlignedAfterTransformChange(
        comfyPage.page,
        widget,
        before
      )
    })

    test('subgraph-promoted DOM widget stays aligned with its node after one viewport resize', async ({
      comfyPage
    }) => {
      await comfyPage.page.setViewportSize(SMALL_VIEWPORT)
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-promoted-text-widget'
      )

      const widget = comfyPage.page
        .locator('.dom-widget')
        .filter({ has: comfyPage.page.getByRole('textbox', { name: 'text' }) })
      await expect(widget).toBeVisible()

      const before = await snapshotDomWidget(comfyPage.page, widget)

      await comfyPage.page.setViewportSize(LARGE_VIEWPORT)
      await comfyPage.nextFrame()

      await expectDomWidgetAlignedAfterTransformChange(
        comfyPage.page,
        widget,
        before
      )
    })

    test('DOM widget stays aligned through a rapid, discontinuous sequence of viewport resizes', async ({
      comfyPage
    }) => {
      test.setTimeout(30_000)
      await comfyPage.page.setViewportSize(SMALL_VIEWPORT)
      await comfyPage.workflow.loadWorkflow('widgets/multiline_single_node')

      const widget = comfyPage.page.locator('.dom-widget')
      await expect(widget).toBeVisible()

      const before = await snapshotDomWidget(comfyPage.page, widget)

      for (const size of RAPID_RESIZE_STEPS) {
        await comfyPage.page.setViewportSize(size)
      }
      await comfyPage.nextFrame()

      await expectDomWidgetAlignedAfterTransformChange(
        comfyPage.page,
        widget,
        before
      )
    })

    test(
      'DOM widget stays aligned through rapid viewport resizes in Vue Nodes mode',
      { tag: '@vue-nodes' },
      async ({ comfyPage }) => {
        test.setTimeout(30_000)
        await comfyPage.page.setViewportSize(SMALL_VIEWPORT)
        await comfyPage.workflow.loadWorkflow('widgets/multiline_single_node')
        await comfyPage.vueNodes.waitForNodes()

        // Vue Nodes renders the widget as a plain child of the node's own DOM
        // tree rather than the `.dom-widget` canvas-position overlay used in
        // Classic/LiteGraph mode. That means the browser propagates the
        // node's CSS transform to the widget for free on resize, so checking
        // the widget against the canvas transform (like the Classic-mode
        // tests above) would always pass by CSS cascade and never actually
        // exercise anything. What can regress instead is the widget's
        // position relative to its own parent node element, so that's the
        // invariant asserted here.
        const node = comfyPage.vueNodes.getNodeLocator('1')
        const widget = node.getByRole('textbox')
        await expect(widget).toBeVisible()

        const before = await snapshotRelativeOffset(node, widget)

        for (const size of RAPID_RESIZE_STEPS) {
          await comfyPage.page.setViewportSize(size)
        }
        await comfyPage.nextFrame()

        await expectRelativeOffsetUnchanged(node, widget, before)
      }
    )
  }
)
