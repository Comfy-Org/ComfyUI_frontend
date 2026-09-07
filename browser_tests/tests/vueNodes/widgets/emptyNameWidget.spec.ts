import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

const HOST_NODE_TYPE = 'KSampler'
const HOST_NODE_TITLE = 'KSampler'

/**
 * Regression for #13773: a custom node that registers a client-side widget with
 * an empty/placeholder name produces an un-keyable widget id (empty name
 * segment). Before the fix, `parseWidgetId` threw on that id, which tripped the
 * Vue `NodeWidgets` error boundary and blanked the node's ENTIRE widget grid
 * (e.g. rgthree Power Lora Loader rendered no widgets). The un-storable widget
 * must not take down its schema-declared siblings.
 */
test.describe(
  'Empty-name custom widget',
  { tag: ['@vue-nodes', '@widget'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      // Emulate a custom node registering an extra, un-keyable widget
      await comfyPage.nodeOps.clearGraph()
      await comfyPage.nodeOps.addNode(HOST_NODE_TITLE, undefined, {
        x: 400,
        y: 200
      })
      await comfyPage.page.evaluate(() =>
        graph!.nodes[0].addWidget('text', '', '', () => {})
      )
    })

    test('renders schema widgets despite an un-keyable sibling', async ({
      comfyPage
    }) => {
      const node = comfyPage.vueNodes.getNodeByTitle(HOST_NODE_TITLE)
      await expect(node).toBeVisible()

      // Precondition: the un-keyable empty-name widget really is on the node, so
      // this test exercises the regression rather than passing vacuously.
      await expect
        .poll(() =>
          comfyPage.page.evaluate((type) => {
            const host = window.app!.graph.nodes.find((n) => n.type === type)
            return host?.widgets?.some((w) => w.name === '') ?? false
          }, HOST_NODE_TYPE)
        )
        .toBe(true)

      // The widget grid must render (v-else branch), not the error boundary.
      await expect(node.getByTestId(TestIds.widgets.container)).toBeVisible()
      await expect(node.locator('.node-error')).toHaveCount(0)

      // Schema-declared siblings must still render and be interactable.
      await expect(node.getByLabel('seed', { exact: true })).toBeVisible()
      await expect(node.getByLabel('steps', { exact: true })).toBeVisible()
      await expect(node.getByLabel('cfg', { exact: true })).toBeVisible()
    })
  }
)
