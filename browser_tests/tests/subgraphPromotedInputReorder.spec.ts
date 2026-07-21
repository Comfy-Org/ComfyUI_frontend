import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

const SUBGRAPH_NODE_ID = '11'
const SUBGRAPH_TITLE = 'New Subgraph'
const PROMOTED_WIDGETS = ['text', 'text_1', 'text_2']

/**
 * The templates browser auto-opens for a fresh user; its overlay swallows
 * pointer events, so dismiss it before driving the panel.
 */
async function closeTemplatesDialogIfOpen(comfyPage: ComfyPage) {
  const templatesDialog = comfyPage.page
    .getByRole('dialog')
    .filter({ has: comfyPage.templates.content })
  const closeButton = templatesDialog.getByRole('button', {
    name: 'Close dialog'
  })
  await closeButton
    .waitFor({ state: 'visible', timeout: 1_000 })
    .catch(() => undefined)
  if (await closeButton.isVisible()) {
    await closeButton.click()
    await expect(templatesDialog).toBeHidden()
  }
}

/** Promoted-widget order as the subgraph node itself sees it. */
function promotedWidgetOrder(comfyPage: ComfyPage): Promise<string[]> {
  return comfyPage.page.evaluate((id) => {
    const node = window.app!.graph.nodes.find(
      (n: LGraphNode) => String(n.id) === id
    )
    return (node?.widgets ?? []).map((w) => w.name)
  }, SUBGRAPH_NODE_ID)
}

test.describe(
  'Subgraph promoted-input reorder',
  { tag: ['@node', '@widget'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-three-promoted-widgets'
      )
      await closeTemplatesDialogIfOpen(comfyPage)

      const [subgraphNode] =
        await comfyPage.nodeOps.getNodeRefsByTitle(SUBGRAPH_TITLE)
      expect(subgraphNode, 'subgraph node present in fixture').toBeTruthy()
      await subgraphNode.centerOnNode()
      await subgraphNode.click('title')

      if (!(await comfyPage.menu.propertiesPanel.root.isVisible())) {
        await comfyPage.actionbar.propertiesButton.click()
      }
      await expect(comfyPage.menu.propertiesPanel.root).toBeVisible()
    })

    test('dragging a promoted input to a new slot reorders the section', async ({
      comfyPage
    }) => {
      const rows = comfyPage.page
        .getByTestId('section-widgets-list')
        .first()
        .locator('.widget-item')
      await expect(rows).toHaveCount(PROMOTED_WIDGETS.length)

      // The section's DraggableList is wired up by a debounced watcher; a
      // search round-trip flips `isDraggable` and settles that watch so the
      // rows are grabbable without racing on debounce timing.
      const { searchBox } = comfyPage.menu.propertiesPanel
      await searchBox.fill('t')
      await searchBox.fill('')
      await expect
        .poll(() => promotedWidgetOrder(comfyPage))
        .toEqual(PROMOTED_WIDGETS)

      const first = await rows.nth(0).boundingBox()
      const last = await rows.nth(2).boundingBox()
      if (!first || !last) throw new Error('promoted-input row not visible')

      // Grab the row by its header strip: the widget body owns its own pointer
      // events, but the header is pointer-events-none so the grab lands on the
      // draggable row itself.
      const { mouse } = comfyPage.page
      await mouse.move(first.x + first.width / 2, first.y + 8)
      await mouse.down()
      await mouse.move(last.x + last.width / 2, last.y + last.height * 0.95, {
        steps: 20
      })
      await mouse.up()

      await expect
        .poll(() => promotedWidgetOrder(comfyPage))
        .toEqual(['text_1', 'text_2', 'text'])
    })
  }
)
