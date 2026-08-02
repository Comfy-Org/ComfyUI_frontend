import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import {
  expectDomWidgetAlignedAfterTransformChange,
  snapshotDomWidget
} from '@e2e/fixtures/utils/domWidgetAlignment'

const LARGE_VIEWPORT = { width: 1920, height: 1080 }
const SMALL_VIEWPORT = { width: 900, height: 600 }

const RAPID_RESIZE_STEPS = [
  { width: 1000, height: 650 },
  { width: 1400, height: 950 },
  { width: 1100, height: 700 },
  { width: 1920, height: 1080 },
  { width: 1300, height: 800 },
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
      await expect.soft(widget).toBeVisible()

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
      await expect.soft(widget).toBeVisible()

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
      await expect.soft(widget).toBeVisible()

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
        // Classic/LiteGraph mode.
        const widget = comfyPage.vueNodes
          .getNodeLocator('1')
          .getByRole('textbox')
        await expect.soft(widget).toBeVisible()

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
      }
    )
  }
)
