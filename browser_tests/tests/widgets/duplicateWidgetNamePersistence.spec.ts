import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { openWorkflowFromSidebar } from '@e2e/fixtures/utils/builderTestUtils'

import { zComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'

const defaults = [{ source: 'first default' }, { source: 'second default' }]
const savedValues = [
  {
    trim: { start_time: 1, duration: 2 },
    extension_only: { untouched: true }
  },
  {
    crop: { x: 1, y: 2, width: 3, height: 4 },
    unknown_key: ['kept', 2]
  }
]

test.describe(
  'duplicate widget-name persistence',
  { tag: ['@canvas', '@widget', '@vue-nodes'] },
  () => {
    test('preserves both dict-shaped values across a live workflow save and reload', async ({
      comfyPage
    }) => {
      await comfyPage.nodeOps.clearGraph()
      await comfyPage.page.evaluate((widgetDefaults) => {
        const nodeType =
          window.LiteGraph!.registered_node_types[
            'DevToolsNodeWithDuplicateNamedWidgets'
          ]
        const onNodeCreated = nodeType.prototype.onNodeCreated
        nodeType.prototype.onNodeCreated = function (...args) {
          onNodeCreated?.apply(this, args)
          this.serialize_widgets = true
          for (const value of widgetDefaults) {
            this.addWidget('custom', 'duplicate', value, () => {})
          }
        }
      }, defaults)
      await comfyPage.searchBoxV2.addNode('Duplicate Named Widgets')
      await comfyPage.page.evaluate((values) => {
        const [node] = window.app!.graph.nodes
        node.widgets![0].value = values[0]
        node.widgets![1].value = values[1]
      }, savedValues)

      const workflowName = `duplicate-widgets-${Date.now()}`
      try {
        await comfyPage.menu.topbar.saveWorkflowAs(workflowName)
        await comfyPage.workflow.newBlankWorkflow()
        await comfyPage.menu.topbar.closeWorkflowTab(workflowName)
        await openWorkflowFromSidebar(comfyPage, workflowName)

        await expect
          .poll(() => comfyPage.workflow.getGraphNodeIds())
          .toHaveLength(1)
        const [nodeId] = await comfyPage.workflow.getGraphNodeIds()
        await expect(comfyPage.vueNodes.getNodeLocator(nodeId)).toBeVisible()

        const savedRequest = comfyPage.page.waitForRequest(
          (request) =>
            request.method() === 'POST' &&
            decodeURIComponent(new URL(request.url()).pathname).endsWith(
              `/workflows/${workflowName}.json`
            )
        )
        await comfyPage.menu.topbar.triggerTopbarCommand(['File', 'Save'])
        const saved = zComfyWorkflow.parse(
          JSON.parse((await savedRequest).postData() ?? '{}')
        )
        const duplicateNode = saved.nodes.find(
          (node) => node.type === 'DevToolsNodeWithDuplicateNamedWidgets'
        )

        expect(duplicateNode?.widgets_values).toEqual(savedValues)
      } finally {
        await comfyPage.workflow.deleteWorkflow(workflowName)
      }
    })
  }
)
