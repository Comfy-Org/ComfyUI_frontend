import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import { openWorkflowFromSidebar } from '@e2e/fixtures/utils/builderTestUtils'

/**
 * A widget named `__proto__` lost its value on every reload.
 *
 * `serialiseWidgetValues` filled `widgets_values_named` by assignment, and for
 * that one name the assignment runs the inherited `Object.prototype.__proto__`
 * setter instead of creating an own key. The restore checks `Object.hasOwn`,
 * finds nothing, and hands the widget its default back — without falling
 * through to the positional register, because a present named register means
 * "no value under this name".
 *
 * An odd name, but it is reachable from any node definition, and the same
 * assignment is what would have made the register's prototype a user value.
 *
 * The named-restore path is the experimental `Comfy.Workflow.NamedValuesRestore`
 * setting, off by default, so this is a defect in that path rather than one
 * every user is hitting today. The setting is what the case turns on.
 */

const workflowName = `proto-named-widget-${Date.now()}`
const WIDGET_NAME = '__proto__'
const TYPED_VALUE = 'survives the reload'

test.describe(
  'widget named __proto__',
  { tag: ['@canvas', '@widget', '@vue-nodes'] },
  () => {
    test.use({
      initialSettings: { 'Comfy.Workflow.NamedValuesRestore': true }
    })

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.workflow.deleteWorkflow(workflowName)
    })

    test('keeps its value after saving, closing and reopening', async ({
      comfyPage
    }) => {
      await comfyPage.nodeOps.clearGraph()
      await comfyPage.page.evaluate((widgetName) => {
        const nodeType =
          window.LiteGraph!.registered_node_types['DevToolsNodeWithOutputList']
        const onNodeCreated = nodeType.prototype.onNodeCreated
        nodeType.prototype.onNodeCreated = function (...args) {
          onNodeCreated?.apply(this, args)
          this.serialize_widgets = true
          this.addWidget('string', widgetName, 'construction default', () => {})
        }
      }, WIDGET_NAME)

      const nodeId = await comfyPage.searchBoxV2.addNodeAndGetId(
        'Node With Output List'
      )
      await expect(comfyPage.vueNodes.getNodeLocator(nodeId)).toBeVisible()

      const widgetRow = () =>
        comfyPage.page.getByTestId(TestIds.widgets.widget).filter({
          has: comfyPage.page
            .getByTestId(TestIds.widgets.layoutFieldLabel)
            .and(comfyPage.page.getByText(WIDGET_NAME, { exact: true }))
        })

      await widgetRow().locator('input').fill(TYPED_VALUE)
      await widgetRow().locator('input').blur()
      await comfyPage.menu.topbar.saveWorkflowAs(workflowName)

      await comfyPage.workflow.newBlankWorkflow()
      await comfyPage.menu.topbar.closeWorkflowTab(workflowName)
      await openWorkflowFromSidebar(comfyPage, workflowName)

      await expect(widgetRow().locator('input')).toHaveValue(TYPED_VALUE)
    })
  }
)
