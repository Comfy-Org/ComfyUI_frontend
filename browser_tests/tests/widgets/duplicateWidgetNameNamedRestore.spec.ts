import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { openWorkflowFromSidebar } from '@e2e/fixtures/utils/builderTestUtils'
import {
  duplicateSavedValues,
  installUnrenameableDuplicatePair,
  readWidgetNames,
  readWidgetValues,
  writeWidgetValues
} from '@e2e/fixtures/utils/duplicateWidgetNames'

import { zComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'

/**
 * A node whose repeated widget name could not be renamed keeps two
 * serializable widgets called `duplicate`, at which point
 * `widgets_values_named` can only hold the last of them. This case covers that
 * path through the real save and reload route, with
 * `Comfy.Workflow.NamedValuesRestore` on — where named values are what the
 * canvas is rebuilt from.
 *
 * Source: FE-3036, item 5 of PM-1783.
 */
const workflowName = `duplicate-widget-names-named-${Date.now()}`

test.use({
  initialSettings: { 'Comfy.Workflow.NamedValuesRestore': true }
})

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
      await comfyPage.nodeOps.clearGraph()

      await installUnrenameableDuplicatePair(comfyPage)

      const nodeId =
        await test.step('save a node carrying two widgets named "duplicate"', async () => {
          const addedNodeId = await comfyPage.searchBoxV2.addNodeAndGetId(
            'Node With Output List'
          )
          const liveNames = await readWidgetNames(comfyPage, addedNodeId)
          // The premise of the whole case: the rename did not happen, so the
          // name really is ambiguous on the live canvas.
          expect(liveNames).toEqual(['duplicate', 'duplicate'])

          // Written onto the live widgets, never passed as construction
          // defaults: a widget built holding the asserted value would make the
          // canvas assertion below pass with restore switched off entirely.
          await writeWidgetValues(comfyPage, addedNodeId, duplicateSavedValues)

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
          const savedNode = saved.nodes.find(
            (node) => node.type === 'DevToolsNodeWithOutputList'
          )

          // `widgets_values_named` physically cannot carry both, so the
          // occurrence-addressed form is what the reload below reads.
          expect(savedNode?.widgets_values_named).toEqual({
            duplicate: duplicateSavedValues[1]
          })
          expect(savedNode?.widgets_values_ordered).toEqual([
            {
              name: 'duplicate',
              occurrence: 0,
              value: duplicateSavedValues[0]
            },
            { name: 'duplicate', occurrence: 1, value: duplicateSavedValues[1] }
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
        const liveValues = await readWidgetValues(comfyPage, nodeId)

        expect(liveValues).toEqual(duplicateSavedValues)
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

        expect(duplicateNode?.widgets_values).toEqual(duplicateSavedValues)
        expect(duplicateNode?.widgets_values_ordered).toEqual([
          { name: 'duplicate', occurrence: 0, value: duplicateSavedValues[0] },
          { name: 'duplicate', occurrence: 1, value: duplicateSavedValues[1] }
        ])
      })
    })
  }
)
