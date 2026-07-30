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
 * partially below the fold. Fitting the view keeps resize handles and the
 * subgraph-enter footer button on-screen for subsequent screen-space clicks
 * and drags.
 */
async function fitViewToNodes(comfyPage: ComfyPage): Promise<void> {
  await comfyPage.canvas.click({ position: { x: 10, y: 10 } })
  await comfyPage.keyboard.press('Period')
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
      await comfyPage.nodeOps.resizeNode(nodePos, nodeSize, 2.5, 2.5)
      const resizedSize = await outerHost.getSize()
      expect(resizedSize.width).toBeGreaterThan(nodeSize.width)
      expect(resizedSize.height).toBeGreaterThan(nodeSize.height)

      await outerHost.click('title')
      await comfyPage.actionbar.propertiesButton.click()
      const editorToggle = comfyPage.page.getByTestId('subgraph-editor-toggle')
      if (await editorToggle.isVisible()) await editorToggle.click()

      const shownSection = comfyPage.page.getByTestId(
        'subgraph-editor-shown-section'
      )
      await expect(shownSection).toBeVisible()
      const toggleButtons = shownSection.getByTestId('subgraph-widget-toggle')
      await expect(toggleButtons.first()).toBeVisible()
      await toggleButtons.first().click()

      await expect
        .poll(async () => (await outerHost.getSize()).width)
        .toBeCloseTo(resizedSize.width, 0)
      const finalSize = await outerHost.getSize()
      expect(finalSize.height).toBeCloseTo(resizedSize.height, 0)
    })
  }
)
