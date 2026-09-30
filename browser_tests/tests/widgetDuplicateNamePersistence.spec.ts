import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { openWorkflowFromSidebar } from '@e2e/fixtures/utils/builderTestUtils'

test.describe(
  'duplicate widget-name persistence',
  { tag: ['@canvas', '@widget', '@vue-nodes'] },
  () => {
    test('preserves both dict-shaped values across a live workflow save and reload', async ({
      comfyPage
    }) => {
      await comfyPage.nodeOps.clearGraph()
      await comfyPage.page.evaluate(() => {
        const nodeType =
          window.LiteGraph!.registered_node_types[
            'DevToolsNodeWithDuplicateNamedWidgets'
          ]
        const onNodeCreated = nodeType.prototype.onNodeCreated
        nodeType.prototype.onNodeCreated = function (...args) {
          onNodeCreated?.apply(this, args)
          this.serialize_widgets = true
          this.addWidget(
            'custom',
            'duplicate',
            {
              trim: { start_time: 1, duration: 2 },
              extension_only: { untouched: true }
            },
            () => {}
          )
          this.addWidget(
            'custom',
            'duplicate',
            {
              crop: { x: 1, y: 2, width: 3, height: 4 },
              unknown_key: ['kept', 2]
            },
            () => {}
          )
        }
      })
      await comfyPage.searchBoxV2.addNode('Duplicate Named Widgets')
      const workflowName = `duplicate-widgets-${Date.now()}`
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
      await comfyPage.page.keyboard.press('ControlOrMeta+s')
      const saved = JSON.parse((await savedRequest).postData() ?? '{}') as {
        nodes?: Array<{
          type?: string
          widgets_values_ordered?: unknown
        }>
      }

      expect(
        saved.nodes?.find(
          (node) => node.type === 'DevToolsNodeWithDuplicateNamedWidgets'
        )?.widgets_values_ordered
      ).toEqual([
        {
          name: 'duplicate',
          occurrence: 0,
          value: {
            trim: { start_time: 1, duration: 2 },
            extension_only: { untouched: true }
          }
        },
        {
          name: 'duplicate',
          occurrence: 1,
          value: {
            crop: { x: 1, y: 2, width: 3, height: 4 },
            unknown_key: ['kept', 2]
          }
        }
      ])
    })
  }
)
