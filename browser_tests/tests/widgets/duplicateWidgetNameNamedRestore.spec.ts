import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { openWorkflowFromSidebar } from '@e2e/fixtures/utils/builderTestUtils'

import { zComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'

/**
 * `ensureUniqueWidgetNames` normally renames a repeated widget name to
 * `name#1` before any widget id is derived, so `widgets_values_named` is
 * unambiguous and `duplicateWidgetNamePersistence.spec.ts`'s two `duplicate`
 * widgets actually persist as `duplicate` and `duplicate#1`.
 *
 * It cannot rename a widget whose `name` is not writable. It warns, gives up,
 * and the node keeps two serializable widgets with one name — at which point
 * `widgets_values_named` can only hold the last of them. These cases cover
 * that path with `Comfy.Workflow.NamedValuesRestore` on, where named values
 * are what the canvas is rebuilt from.
 *
 * Source: FE-3036, item 5 of PM-1783.
 */
const workflowName = `duplicate-widget-names-named-${Date.now()}`

const savedValues = [
  { trim: { start_time: 1, duration: 2 }, extension_only: { untouched: true } },
  { crop: { x: 1, y: 2, width: 3, height: 4 }, unknown_key: ['kept', 2] }
]

test.describe(
  'duplicate widget-name persistence under named-value restore',
  { tag: ['@canvas', '@widget', '@vue-nodes'] },
  () => {
    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.workflow.deleteWorkflow(workflowName)
    })

    test('keeps both values of an unrenameable duplicate name across a reload', async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting(
        'Comfy.Workflow.NamedValuesRestore',
        true
      )
      await comfyPage.nodeOps.clearGraph()

      // Installed on the node type, so the reconstruction after reload builds
      // the same unrenameable pair the save was made from.
      await comfyPage.page.evaluate((values) => {
        const nodeType =
          window.LiteGraph!.registered_node_types['DevToolsNodeWithOutputList']
        const onNodeCreated = nodeType.prototype.onNodeCreated
        nodeType.prototype.onNodeCreated = function (...args) {
          onNodeCreated?.apply(this, args)
          this.serialize_widgets = true
          this.addWidget('custom', 'duplicate', values[0], () => {})
          const second = this.addWidget('custom', 'second', values[1], () => {})
          Object.defineProperty(second, 'name', {
            value: 'duplicate',
            writable: false,
            configurable: false
          })
        }
      }, savedValues)

      const nodeId =
        await test.step('save a node carrying two widgets named "duplicate"', async () => {
          const savedRequest = comfyPage.page.waitForRequest(
            (request) =>
              request.method() === 'POST' &&
              decodeURIComponent(new URL(request.url()).pathname).endsWith(
                `/workflows/${workflowName}.json`
              )
          )
          const addedNodeId = await comfyPage.searchBoxV2.addNodeAndGetId(
            'Node With Output List'
          )
          const liveNames = await comfyPage.page.evaluate((id) => {
            const node = window.app!.graph.nodes.find(
              ({ id: nodeId }) => String(nodeId) === id
            )!
            return node.widgets!.map((widget) => widget.name)
          }, addedNodeId)
          // The premise of the whole case: the rename did not happen, so the
          // name really is ambiguous on the live canvas.
          expect(liveNames).toEqual(['duplicate', 'duplicate'])

          await comfyPage.menu.topbar.saveWorkflowAs(workflowName)
          const saved = zComfyWorkflow.parse(
            JSON.parse((await savedRequest).postData() ?? '{}')
          )
          const savedNode = saved.nodes.find(
            (node) => node.type === 'DevToolsNodeWithOutputList'
          )

          // `widgets_values_named` physically cannot carry both, so the
          // occurrence-addressed form is what the reload below reads.
          expect(savedNode?.widgets_values_named).toEqual({
            duplicate: savedValues[1]
          })
          expect(savedNode?.widgets_values_ordered).toEqual([
            { name: 'duplicate', occurrence: 0, value: savedValues[0] },
            { name: 'duplicate', occurrence: 1, value: savedValues[1] }
          ])

          return addedNodeId
        })

      await test.step('close and reopen the saved workflow', async () => {
        await comfyPage.workflow.newBlankWorkflow()
        await comfyPage.menu.topbar.closeWorkflowTab(workflowName)
        await openWorkflowFromSidebar(comfyPage, workflowName)

        await expect(comfyPage.vueNodes.getNodeLocator(nodeId)).toBeVisible()
      })

      await test.step('both values are back on the canvas, not two copies of the last one', async () => {
        const liveValues = await comfyPage.page.evaluate((id) => {
          const node = window.app!.graph.nodes.find(
            ({ id: nodeId }) => String(nodeId) === id
          )!
          return node.widgets!.map((widget) => widget.value)
        }, nodeId)

        expect(liveValues).toEqual(savedValues)
      })

      await test.step('re-saving keeps both values', async () => {
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
        expect(duplicateNode?.widgets_values_ordered).toEqual([
          { name: 'duplicate', occurrence: 0, value: savedValues[0] },
          { name: 'duplicate', occurrence: 1, value: savedValues[1] }
        ])
      })
    })

    test('omits the ordered form when the rename succeeds', async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting(
        'Comfy.Workflow.NamedValuesRestore',
        true
      )
      await comfyPage.nodeOps.clearGraph()

      await comfyPage.page.evaluate((values) => {
        const nodeType =
          window.LiteGraph!.registered_node_types['DevToolsNodeWithOutputList']
        const onNodeCreated = nodeType.prototype.onNodeCreated
        nodeType.prototype.onNodeCreated = function (...args) {
          onNodeCreated?.apply(this, args)
          this.serialize_widgets = true
          for (const value of values) {
            this.addWidget('custom', 'duplicate', value, () => {})
          }
        }
      }, savedValues)

      const savedRequest = comfyPage.page.waitForRequest(
        (request) =>
          request.method() === 'POST' &&
          decodeURIComponent(new URL(request.url()).pathname).endsWith(
            `/workflows/${workflowName}.json`
          )
      )
      const nodeId = await comfyPage.searchBoxV2.addNodeAndGetId(
        'Node With Output List'
      )
      const liveNames = await comfyPage.page.evaluate((id) => {
        const node = window.app!.graph.nodes.find(
          ({ id: nodeId }) => String(nodeId) === id
        )!
        return node.widgets!.map((widget) => widget.name)
      }, nodeId)
      expect(liveNames).toEqual(['duplicate', 'duplicate#1'])

      await comfyPage.menu.topbar.saveWorkflowAs(workflowName)
      const saved = zComfyWorkflow.parse(
        JSON.parse((await savedRequest).postData() ?? '{}')
      )
      const savedNode = saved.nodes.find(
        (node) => node.type === 'DevToolsNodeWithOutputList'
      )

      // Every ordinary workflow stays byte-identical: the names are already
      // unambiguous, so there is nothing for the ordered form to add.
      expect(savedNode).not.toHaveProperty('widgets_values_ordered')
      expect(savedNode?.widgets_values_named).toEqual({
        duplicate: savedValues[0],
        'duplicate#1': savedValues[1]
      })
    })
  }
)
