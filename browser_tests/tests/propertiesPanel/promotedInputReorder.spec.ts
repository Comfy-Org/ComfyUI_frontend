import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
import { PropertiesPanelHelper } from '@e2e/tests/propertiesPanel/PropertiesPanelHelper'

const SUBGRAPH_NODE_ID = '11'
const SUBGRAPH_TITLE = 'New Subgraph'
const PROMOTED_WIDGETS = ['text', 'text_1', 'text_2']

test.describe(
  'Subgraph promoted-input reorder',
  { tag: ['@node', '@widget'] },
  () => {
    let panel: PropertiesPanelHelper

    test.beforeEach(async ({ comfyPage }) => {
      panel = new PropertiesPanelHelper(comfyPage.page)

      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-three-promoted-widgets'
      )

      const [subgraphNode] =
        await comfyPage.nodeOps.getNodeRefsByTitle(SUBGRAPH_TITLE)
      expect(subgraphNode, 'subgraph node present in fixture').toBeTruthy()
      await subgraphNode.centerOnNode()
      await subgraphNode.click('title')

      await panel.open(comfyPage.actionbar.propertiesButton)
      await expect(panel.root).toBeVisible()
    })

    test('dragging a promoted input to a new slot reorders the section', async ({
      comfyPage
    }) => {
      await expect(panel.sectionWidgetRows).toHaveCount(PROMOTED_WIDGETS.length)

      // The section's DraggableList is wired up by a debounced watcher; a
      // search round-trip flips `isDraggable` and settles that watch so the
      // rows are grabbable without racing on debounce timing.
      await panel.searchWidgets('t')
      await panel.clearSearch()
      await expect
        .poll(() => comfyPage.subgraph.getPromotedWidgetOrder(SUBGRAPH_NODE_ID))
        .toEqual(PROMOTED_WIDGETS)

      await panel.dragSectionWidgetRow(0, 2)

      await expect
        .poll(() => comfyPage.subgraph.getPromotedWidgetOrder(SUBGRAPH_NODE_ID))
        .toEqual(['text_1', 'text_2', 'text'])
    })
  }
)
