import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

/**
 * FE-853: a subgraph node the user has manually resized snaps back to its
 * computed minimum size as soon as the widget-editing UI is triggered — either
 * by the "Edit Subgraph Widgets" selection-toolbox button or by promoting a
 * widget from inside the subgraph — discarding the size the user set.
 *
 * https://linear.app/comfyorg/issue/FE-853
 */

const SUBGRAPH_TITLE = 'New Subgraph'
const RESIZE_DELTA = { x: 250, y: 250 }
/** KSampler inside the `basic-subgraph` fixture's subgraph definition. */
const INTERIOR_KSAMPLER_ID = '1'

/**
 * Loads the subgraph fixture and grows the subgraph node by dragging its
 * bottom-right handle, the way a user would.
 *
 * Sizes are read from the graph model rather than from DOM bounding boxes so
 * that the assertions stay independent of canvas zoom and of the canvas
 * shrinking when the right side panel opens.
 */
async function loadResizedSubgraph(comfyPage: ComfyPage) {
  await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')

  const [nodeRef] = await comfyPage.nodeOps.getNodeRefsByTitle(SUBGRAPH_TITLE)
  expect(nodeRef, `${SUBGRAPH_TITLE} node is on the canvas`).toBeDefined()

  // The fixture is saved with a pan that leaves the node low in the viewport,
  // so a downward resize drag would run off screen.
  await nodeRef.centerOnNode()

  const node = await comfyPage.vueNodes.getFixtureByTitle(SUBGRAPH_TITLE)
  const sizeBefore = await nodeRef.getSize()
  await node.resizeFromCorner('SE', RESIZE_DELTA.x, RESIZE_DELTA.y)
  await comfyPage.nextFrame()

  const resizedSize = await nodeRef.getSize()
  expect(resizedSize.width, 'manual resize widened the node').toBeGreaterThan(
    sizeBefore.width
  )
  expect(
    resizedSize.height,
    'manual resize heightened the node'
  ).toBeGreaterThan(sizeBefore.height)

  return { nodeRef, node, resizedSize }
}

test.describe(
  'Subgraph node size across widget editing',
  { tag: ['@subgraph', '@node', '@widget', '@vue-nodes'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.Canvas.SelectionToolbox', true)
    })

    test('retains a manual resize when Edit Subgraph Widgets is clicked', async ({
      comfyPage
    }) => {
      const { nodeRef, node, resizedSize } =
        await loadResizedSubgraph(comfyPage)

      await node.select()
      await comfyPage.selectionToolbox
        .getByRole('button', { name: 'Edit Subgraph Widgets' })
        .click()
      await expect(comfyPage.subgraph.editor.root).toBeVisible()
      await comfyPage.nextFrame()

      const size = await nodeRef.getSize()
      expect(size.width).toBeCloseTo(resizedSize.width, 0)
      expect(size.height).toBeCloseTo(resizedSize.height, 0)
    })

    test('retains a manual resize when an interior widget is promoted', async ({
      comfyPage
    }) => {
      const { nodeRef, resizedSize } = await loadResizedSubgraph(comfyPage)

      await comfyPage.vueNodes.enterSubgraph(String(nodeRef.id))
      await comfyPage.subgraph.promoteWidget(
        comfyPage.vueNodes.getNodeLocator(INTERIOR_KSAMPLER_ID),
        'steps'
      )
      await comfyPage.subgraph.exitViaBreadcrumb()

      const size = await nodeRef.getSize()
      expect(size.width).toBeCloseTo(resizedSize.width, 0)
      // A newly promoted widget can legitimately raise the minimum height, so
      // only a shrink below the user's size is a regression.
      expect(size.height).toBeGreaterThanOrEqual(resizedSize.height)
    })
  }
)
