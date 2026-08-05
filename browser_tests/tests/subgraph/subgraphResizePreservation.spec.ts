import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

/**
 * Regression coverage for FE-853: promoting/demoting a widget on a subgraph
 * node — or merely opening the right-side properties panel for one — used to
 * collapse the node back to its computed minimum size, discarding whatever
 * size the user had explicitly set.
 */

/**
 * These fixture workflows carry a saved pan/zoom that was not authored
 * against the default 1280x720 Playwright viewport, so nodes can load
 * partially below the fold. Panning the nodes into view keeps resize
 * handles and the subgraph-enter footer button on-screen for subsequent
 * screen-space clicks and drags.
 *
 * This deliberately pans rather than using the app's zoom-to-fit command:
 * these tests compute drag targets and pixel-space size deltas directly
 * from node.pos/node.size, which only line up with on-screen pixels when
 * the canvas scale is 1. Panning leaves scale untouched, so it also avoids
 * the 'Top' menu bar's workflow tab strip, which renders above the canvas
 * and would intercept a click at a fixed coordinate.
 */
async function fitViewToNodes(comfyPage: ComfyPage): Promise<void> {
  await comfyPage.page.evaluate(() => {
    const canvas = window.app!.canvas
    const nodes = canvas.graph?.nodes ?? []
    if (nodes.length === 0) return

    const margin = 100
    const left = Math.min(...nodes.map((node) => node.pos[0]))
    const top = Math.min(...nodes.map((node) => node.pos[1]))

    canvas.ds.scale = 1
    canvas.ds.offset = [margin - left, margin - top]
    canvas.setDirty(true, true)
  })
  await comfyPage.nextFrame()
}

test.describe(
  'Subgraph node resize preservation',
  { tag: ['@subgraph', '@widget', '@vue-nodes'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    })

    test('Promoting a widget preserves a user-resized subgraph node', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')
      await fitViewToNodes(comfyPage)

      const subgraphNode =
        await comfyPage.vueNodes.getFixtureByTitle('New Subgraph')
      await subgraphNode.resizeFromCorner('SE', 250, 200)
      await comfyPage.nextFrame()
      const resizedBox = (await subgraphNode.boundingBox())!

      const ksampler = comfyPage.vueNodes.getNodeLocator('1')
      await comfyPage.vueNodes.enterSubgraph('2')
      await comfyPage.subgraph.promoteWidget(ksampler, 'steps')
      await comfyPage.subgraph.exitViaBreadcrumb()

      const box = await subgraphNode.boundingBox()
      expect(box?.width).toBeCloseTo(resizedBox.width, 0)
      expect(box?.height).toBeGreaterThanOrEqual(resizedBox.height - 1)
    })

    test('Un-promoting a widget preserves a user-resized subgraph node', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')
      await fitViewToNodes(comfyPage)

      const subgraphNode =
        await comfyPage.vueNodes.getFixtureByTitle('New Subgraph')
      const ksampler = comfyPage.vueNodes.getNodeLocator('1')
      await comfyPage.vueNodes.enterSubgraph('2')
      await comfyPage.subgraph.promoteWidget(ksampler, 'steps')
      await comfyPage.subgraph.exitViaBreadcrumb()

      await subgraphNode.resizeFromCorner('SE', 250, 200)
      await comfyPage.nextFrame()
      const resizedBox = (await subgraphNode.boundingBox())!

      await comfyPage.vueNodes.enterSubgraph('2')
      await comfyPage.subgraph.unpromoteWidget(ksampler, 'steps')
      await comfyPage.subgraph.exitViaBreadcrumb()

      const box = await subgraphNode.boundingBox()
      expect(box?.width).toBeCloseTo(resizedBox.width, 0)
      expect(box?.height).toBeCloseTo(resizedBox.height, 0)
    })

    test('Opening the properties panel does not shrink a user-resized subgraph node', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')
      await fitViewToNodes(comfyPage)

      const subgraphNode =
        await comfyPage.vueNodes.getFixtureByTitle('New Subgraph')
      await subgraphNode.resizeFromCorner('SE', 250, 200)
      await comfyPage.nextFrame()
      const resizedBox = (await subgraphNode.boundingBox())!

      await subgraphNode.select()
      await comfyPage.actionbar.propertiesButton.click()
      await expect(comfyPage.menu.propertiesPanel.root).toBeVisible()

      const box = await subgraphNode.boundingBox()
      expect(box?.width).toBeCloseTo(resizedBox.width, 0)
      expect(box?.height).toBeCloseTo(resizedBox.height, 0)
    })

    test('Promoting and demoting multiple widgets in sequence preserves the resized size', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')
      await fitViewToNodes(comfyPage)

      const subgraphNode =
        await comfyPage.vueNodes.getFixtureByTitle('New Subgraph')
      await subgraphNode.resizeFromCorner('SE', 300, 250)
      await comfyPage.nextFrame()
      const resizedBox = (await subgraphNode.boundingBox())!
      const ksampler = comfyPage.vueNodes.getNodeLocator('1')

      await comfyPage.vueNodes.enterSubgraph('2')
      await comfyPage.subgraph.promoteWidget(ksampler, 'steps')
      await comfyPage.subgraph.promoteWidget(ksampler, 'cfg')
      await comfyPage.subgraph.exitViaBreadcrumb()

      await expect
        .poll(async () => (await subgraphNode.boundingBox())?.width)
        .toBeCloseTo(resizedBox.width, 0)

      await comfyPage.vueNodes.enterSubgraph('2')
      await comfyPage.subgraph.unpromoteWidget(ksampler, 'steps')
      await comfyPage.subgraph.exitViaBreadcrumb()

      await comfyPage.vueNodes.enterSubgraph('2')
      await comfyPage.subgraph.unpromoteWidget(ksampler, 'cfg')
      await comfyPage.subgraph.exitViaBreadcrumb()

      const box = await subgraphNode.boundingBox()
      expect(box?.width).toBeCloseTo(resizedBox.width, 0)
      expect(box?.height).toBeCloseTo(resizedBox.height, 0)
    })

    test('Manually resizing still works normally after a promotion', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')
      await fitViewToNodes(comfyPage)

      const subgraphNode =
        await comfyPage.vueNodes.getFixtureByTitle('New Subgraph')
      const ksampler = comfyPage.vueNodes.getNodeLocator('1')
      await comfyPage.vueNodes.enterSubgraph('2')
      await comfyPage.subgraph.promoteWidget(ksampler, 'steps')
      await comfyPage.subgraph.exitViaBreadcrumb()

      const boxBeforeResize = (await subgraphNode.boundingBox())!
      await subgraphNode.resizeFromCorner('SE', 200, 150)
      await comfyPage.nextFrame()

      const box = await subgraphNode.boundingBox()
      expect(box?.width).toBeGreaterThan(boxBeforeResize.width)
      expect(box?.height).toBeGreaterThan(boxBeforeResize.height)
    })
  }
)

test.describe(
  'Subgraph node resize preservation — nested subgraphs',
  { tag: ['@subgraph', '@widget', '@vue-nodes'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    })

    test('Demoting a nested promotion does not shrink a user-resized outer host', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-nested-promotion'
      )
      await fitViewToNodes(comfyPage)

      const [outerHost] = await comfyPage.nodeOps.getNodeRefsByTitle('Sub 0')
      expect(outerHost).toBeDefined()

      const nodePos = await outerHost.getPosition()
      const nodeSize = await outerHost.getSize()
      // Keep the ratio modest: resizeNode scales the existing size (not an
      // additive delta), and a larger ratio would push the resized node's
      // bottom edge — and the subgraph-enter footer button below it — off
      // the bottom of the viewport, since the top-left corner stays fixed
      // during a resize-from-corner drag.
      await comfyPage.nodeOps.resizeNode(nodePos, nodeSize, 1.4, 1.4)
      const resizedSize = await outerHost.getSize()
      expect(resizedSize.width).toBeGreaterThan(nodeSize.width)
      expect(resizedSize.height).toBeGreaterThan(nodeSize.height)

      // Node 6 ('Sub 1' instance) exposes a 'value_1' widget that is itself a
      // promotion chain three subgraphs deep (Inner 3 -> Sub 2 -> Sub 1),
      // which Sub 0 re-promotes onto `outerHost`. The per-row toggle in the
      // properties panel is disabled for widgets promoted this way, so
      // demoting has to go through the same context-menu action a user would
      // use: entering the host and un-promoting from the widget's own node.
      await comfyPage.vueNodes.enterSubgraph(String(outerHost.id))
      const sub1Instance = comfyPage.vueNodes.getNodeLocator('6')
      await comfyPage.subgraph.unpromoteWidget(sub1Instance, 'value_1')
      await comfyPage.subgraph.exitViaBreadcrumb()

      await expect
        .poll(async () => (await outerHost.getSize()).width)
        .toBeCloseTo(resizedSize.width, 0)
      const finalSize = await outerHost.getSize()
      expect(finalSize.height).toBeCloseTo(resizedSize.height, 0)
    })
  }
)
