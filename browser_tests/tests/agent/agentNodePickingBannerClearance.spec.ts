import { expect } from '@playwright/test'

import { expectRegionScreenshot } from '@e2e/fixtures/utils/screenshotRegion'
import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'

test.describe(
  'Agent node selection mode framing',
  { tag: ['@cloud', '@canvas', '@screenshot'] },
  () => {
    test.use({ viewport: { width: 1280, height: 640 } })

    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.page.evaluate(() => {
        const graph = window.app!.graph
        let y = 0
        for (const node of graph.nodes) {
          node.pos = [0, y]
          y += node.size[1] + 600
        }
        window.app!.canvas.setDirty(true, true)
      })
      await comfyPage.nextFrame()
    })

    test('frames the graph below the selection-mode banner', async ({
      agentPanel,
      comfyPage
    }) => {
      await expect
        .poll(() =>
          comfyPage.page.evaluate(() => window.app!.graph.nodes.length)
        )
        .toBeGreaterThan(0)

      await agentPanel.enterNodeSelectionMode()
      await comfyPage.canvasOps.waitForViewToSettle()

      const bannerBox = await agentPanel.nodeSelectionBanner.boundingBox()
      if (!bannerBox) throw new Error('banner is not rendered')

      const topTitleY = await comfyPage.page.evaluate(() => {
        const canvas = window.app!.canvas
        const top = Math.min(
          ...canvas.graph!.nodes.map((node) => node.boundingRect[1])
        )
        const [, y] = canvas.ds.convertOffsetToCanvas([0, top])
        return canvas.canvas.getBoundingClientRect().top + y
      })

      expect(topTitleY).toBeGreaterThanOrEqual(bannerBox.y + bannerBox.height)
      await expectRegionScreenshot(
        comfyPage.page,
        [agentPanel.nodeSelectionBanner],
        'node-picking-tall-graph-below-banner.png',
        { padding: 160 }
      )
    })
  }
)
