import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import { openWorkflowFromSidebar } from '@e2e/fixtures/utils/builderTestUtils'

import { zComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'

/**
 * Two widgets on one node cannot share a name: `WidgetId` is
 * `graphId:nodeId:name`, so the second is the same identity, not a second one
 * (ADR-ECS-0008, "Widget identity keys on `name`").
 *
 * `ensureUniqueWidgetNames` keeps that true by renaming the repeat to
 * `name#1`. It cannot rename a widget whose `name` is not writable — it warns
 * and gives up — and the node then carries the ambiguous pair.
 *
 * Measured on the parent commit, this node renders **no widgets at all**:
 * `BaseWidget.setNodeId` bails for every widget on the node, so none is
 * registered and none is drawn, while `node.widgets` holds two under one name.
 * The invariant is enforced instead — the widget that cannot be made unique is
 * refused — and the node goes back to working.
 *
 * Black-box throughout: everything asserted here is what the canvas renders or
 * what the app actually saved.
 */

const workflowName = `unrenamable-duplicate-widget-${Date.now()}`
const NODE_TYPE = 'DevToolsNodeWithOutputList'
const DUPLICATE_NAME = 'duplicate'
const TYPED_VALUE = 'typed by the user'

/**
 * Patches the node type so every instance gains a second serializable widget
 * under a name the first already holds, pinned so it cannot be renamed. On the
 * type rather than the instance, so the node rebuilt after a reload carries the
 * same pair the save was made from.
 */
async function installUnrenameableDuplicate(
  comfyPage: ComfyPage
): Promise<void> {
  await comfyPage.page.evaluate(
    ({ nodeTypeName, duplicateName }) => {
      const nodeType = window.LiteGraph!.registered_node_types[nodeTypeName]
      const onNodeCreated = nodeType.prototype.onNodeCreated
      nodeType.prototype.onNodeCreated = function (...args) {
        onNodeCreated?.apply(this, args)
        this.serialize_widgets = true
        this.addWidget('string', duplicateName, 'first default', () => {})
        const second = this.addWidget(
          'string',
          'second',
          'second default',
          () => {}
        )
        Object.defineProperty(second, 'name', {
          value: duplicateName,
          writable: false,
          configurable: false
        })
      }
    },
    { nodeTypeName: NODE_TYPE, duplicateName: DUPLICATE_NAME }
  )
}

test.describe(
  'unrenamable duplicate widget name',
  { tag: ['@canvas', '@widget', '@vue-nodes'] },
  () => {
    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.workflow.deleteWorkflow(workflowName)
    })

    test('refuses the widget it cannot name uniquely and keeps the node usable', async ({
      comfyPage
    }) => {
      await comfyPage.nodeOps.clearGraph()
      await installUnrenameableDuplicate(comfyPage)

      const nodeId = await comfyPage.searchBoxV2.addNodeAndGetId(
        'Node With Output List'
      )
      const node = comfyPage.vueNodes.getNodeLocator(nodeId)
      await expect(node).toBeVisible()

      const duplicateRows = node.getByTestId(TestIds.widgets.widget).filter({
        has: comfyPage.page
          .getByTestId(TestIds.widgets.layoutFieldLabel)
          .and(comfyPage.page.getByText(DUPLICATE_NAME, { exact: true }))
      })

      await test.step('the canvas shows one widget under the name, not two', async () => {
        await expect(duplicateRows).toHaveCount(1)
      })

      await test.step('what the user types is what the app saves', async () => {
        const input = duplicateRows.locator('input')
        await input.fill(TYPED_VALUE)
        await input.blur()

        const savedRequest = comfyPage.page.waitForRequest(
          (request) =>
            request.method() === 'POST' &&
            decodeURIComponent(new URL(request.url()).pathname).endsWith(
              `/workflows/${workflowName}.json`
            )
        )
        await comfyPage.menu.topbar.saveWorkflowAs(workflowName)
        const saved = zComfyWorkflow.parse(
          JSON.parse((await savedRequest).postData() ?? '{}')
        )
        const savedNode = saved.nodes.find(({ type }) => type === NODE_TYPE)

        expect(savedNode?.widgets_values).toEqual([TYPED_VALUE])
      })

      await test.step('and it is still there after closing and reopening', async () => {
        await comfyPage.workflow.newBlankWorkflow()
        await comfyPage.menu.topbar.closeWorkflowTab(workflowName)
        await openWorkflowFromSidebar(comfyPage, workflowName)

        const reopened = comfyPage.page
          .getByTestId(TestIds.widgets.widget)
          .filter({
            has: comfyPage.page
              .getByTestId(TestIds.widgets.layoutFieldLabel)
              .and(comfyPage.page.getByText(DUPLICATE_NAME, { exact: true }))
          })

        await expect(reopened).toHaveCount(1)
        await expect(reopened.locator('input')).toHaveValue(TYPED_VALUE)
      })
    })
  }
)
