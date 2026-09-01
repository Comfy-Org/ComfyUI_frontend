import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import {
  expectDomWidgetAlignedAfterTransformChange,
  expectRelativeOffsetUnchanged,
  snapshotDomWidget,
  snapshotRelativeOffset
} from '@e2e/fixtures/utils/domWidgetAlignment'

const LARGE_VIEWPORT = { width: 1920, height: 1080 }
const SMALL_VIEWPORT = { width: 900, height: 600 }

const RAPID_RESIZE_STEPS = [
  { width: 1000, height: 650 },
  { width: 1400, height: 950 },
  { width: 1100, height: 700 },
  { width: 1600, height: 900 },
  { width: 1300, height: 800 },
  // Ends on LARGE_VIEWPORT to match the single-resize tests' final viewport.
  { width: 1920, height: 1080 }
]

test.describe(
  'DOM widget alignment across viewport resize',
  {
    tag: ['@widget', '@canvas'],
    annotation: {
      type: 'issue',
      description:
        'DESK2-146: stale DOM widget overlay after an Electron window resize. Repros only in Electron, not a browser tab, so this suite is a regression guard for the underlying resize-sync code paths.'
    }
  },
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

        // Vue Nodes widgets are plain DOM children of their node, so CSS
        // keeps them attached on resize -- assert relative offset instead.
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
