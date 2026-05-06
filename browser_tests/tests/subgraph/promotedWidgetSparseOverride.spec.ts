import { expect } from '@playwright/test'

import type { ComfyApiWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

const SPARSE_OVERRIDE_WORKFLOW =
  'subgraphs/promoted-primitive-node-sparse-override'

const HOST_NODE_ID = '4'
const PROMOTED_WIDGET_NAME = 'value'
const EXTERIOR_VALUE = 'exterior'
const INTERIOR_VALUE = 'interior'

function findPrimitiveStringMultilineValue(
  apiPrompt: ComfyApiWorkflow
): unknown {
  const entry = Object.values(apiPrompt).find(
    (node) => node.class_type === 'PrimitiveStringMultiline'
  )
  return entry?.inputs.value
}

/**
 * Regression test for PR #11811 — promoted-widget sparse-override fix
 * (commit 66c89c8e5).
 *
 * Workflow shape:
 *   - SubgraphNode id=4, widgets_values=["exterior"],
 *     properties.proxyWidgets=[["2", "value"]]
 *   - Interior PrimitiveNode id=2 (lazy widget creation in onAfterGraphConfigured)
 *     widgets_values=["interior"]
 *   - Interior PrimitiveStringMultiline id=1 receives PrimitiveNode value
 *   - Root PreviewAny id=3 consumes the subgraph output
 *
 * The bug: PrimitiveNode's lazy widget creation in onAfterGraphConfigured
 * re-applied widgets_values=["interior"] *after* the SubgraphNode applied its
 * exterior widgets_values, clobbering the per-instance override. The fix
 * defers a replay of promoted-view values from SubgraphNode.onAfterGraphConfigured
 * so the exterior override wins the materialization race, and graphToPrompt's
 * getExecutableWidgetValue walks the ancestor SubgraphNode chain to pick up
 * the per-instance override during prompt build.
 */
test.describe(
  'Promoted widget sparse-override (PrimitiveNode lazy widget)',
  { tag: ['@subgraph', '@vue-nodes', '@widget'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    })

    test('Promoted widget renders the exterior override after load, not the interior default', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(SPARSE_OVERRIDE_WORKFLOW)
      await comfyPage.vueNodes.waitForNodes()

      const hostNode = comfyPage.vueNodes.getNodeLocator(HOST_NODE_ID)
      await expect(hostNode).toBeVisible()

      const promotedTextbox = hostNode.getByRole('textbox', {
        name: PROMOTED_WIDGET_NAME,
        exact: true
      })
      await expect(promotedTextbox).toHaveCount(1)
      await expect(promotedTextbox).toHaveValue(EXTERIOR_VALUE)
      await expect(promotedTextbox).not.toHaveValue(INTERIOR_VALUE)
    })

    test('Prompt-build resolves the exterior override through the ancestor SubgraphNode chain', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(SPARSE_OVERRIDE_WORKFLOW)
      await comfyPage.vueNodes.waitForNodes()

      const apiPrompt = await comfyPage.workflow.getExportedWorkflow({
        api: true
      })

      expect(findPrimitiveStringMultilineValue(apiPrompt)).toBe(EXTERIOR_VALUE)
    })

    test('Editing the promoted widget writes through to the interior and is reflected in prompt-build', async ({
      comfyPage
    }) => {
      const editedValue = 'edited'

      await comfyPage.workflow.loadWorkflow(SPARSE_OVERRIDE_WORKFLOW)
      await comfyPage.vueNodes.waitForNodes()

      const hostNode = comfyPage.vueNodes.getNodeLocator(HOST_NODE_ID)
      const promotedTextbox = hostNode.getByRole('textbox', {
        name: PROMOTED_WIDGET_NAME,
        exact: true
      })
      await expect(promotedTextbox).toHaveValue(EXTERIOR_VALUE)

      await promotedTextbox.fill(editedValue)
      await expect(promotedTextbox).toHaveValue(editedValue)

      const apiPrompt = await comfyPage.workflow.getExportedWorkflow({
        api: true
      })
      expect(findPrimitiveStringMultilineValue(apiPrompt)).toBe(editedValue)
    })

    test('Reloading the workflow without saving resets the promoted widget to the exterior override', async ({
      comfyPage
    }) => {
      const editedValue = 'edited'

      await comfyPage.workflow.loadWorkflow(SPARSE_OVERRIDE_WORKFLOW)
      await comfyPage.vueNodes.waitForNodes()

      const hostNode = comfyPage.vueNodes.getNodeLocator(HOST_NODE_ID)
      const promotedTextbox = hostNode.getByRole('textbox', {
        name: PROMOTED_WIDGET_NAME,
        exact: true
      })

      await promotedTextbox.fill(editedValue)
      await expect(promotedTextbox).toHaveValue(editedValue)

      await comfyPage.workflow.loadWorkflow(SPARSE_OVERRIDE_WORKFLOW)
      await comfyPage.vueNodes.waitForNodes()

      const reloadedHost = comfyPage.vueNodes.getNodeLocator(HOST_NODE_ID)
      const reloadedTextbox = reloadedHost.getByRole('textbox', {
        name: PROMOTED_WIDGET_NAME,
        exact: true
      })
      await expect(reloadedTextbox).toHaveValue(EXTERIOR_VALUE)
    })
  }
)
