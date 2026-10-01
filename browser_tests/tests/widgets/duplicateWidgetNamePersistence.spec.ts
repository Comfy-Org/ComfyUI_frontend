import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { openWorkflowFromSidebar } from '@e2e/fixtures/utils/builderTestUtils'

import { zComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'

const workflowName = `duplicate-widget-names-${Date.now()}`

test.describe(
  'duplicate widget-name persistence',
  { tag: ['@canvas', '@widget', '@vue-nodes'] },
  () => {
    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.workflow.deleteWorkflow(workflowName)
    })

    test('renames the duplicate and keeps both object values across a save, reopen, and re-save, with no occurrence-addressed field', async ({
      comfyPage
    }) => {
      const defaults = [
        { source: 'first default' },
        { source: 'second default' }
      ]
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

      const nodeId =
        await test.step('create and save duplicate widget values', async () => {
          await comfyPage.nodeOps.clearGraph()
          await comfyPage.page.evaluate((widgetDefaults) => {
            const nodeType =
              window.LiteGraph!.registered_node_types[
                'DevToolsNodeWithOutputList'
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
          const addedNodeId = await comfyPage.searchBoxV2.addNodeAndGetId(
            'Node With Output List'
          )
          await comfyPage.page.evaluate(
            ({ id, values }) => {
              const node = window.app!.graph.nodes.find(
                ({ id: nodeId }) => String(nodeId) === id
              )!
              node.widgets![0].value = values[0]
              node.widgets![1].value = values[1]
            },
            { id: addedNodeId, values: savedValues }
          )
          await comfyPage.menu.topbar.saveWorkflowAs(workflowName)

          return addedNodeId
        })

      await test.step('close and reopen the saved workflow', async () => {
        await comfyPage.workflow.newBlankWorkflow()
        await comfyPage.menu.topbar.closeWorkflowTab(workflowName)
        await openWorkflowFromSidebar(comfyPage, workflowName)

        await expect(comfyPage.vueNodes.getNodeLocator(nodeId)).toBeVisible()
      })

      await test.step('re-save and assert both reconstructed values', async () => {
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
          (node) => node.type === 'DevToolsNodeWithOutputList'
        )

        expect(duplicateNode?.widgets_values).toEqual(savedValues)
        expect(duplicateNode).not.toHaveProperty('widgets_values_ordered')
      })
    })
  }
)
