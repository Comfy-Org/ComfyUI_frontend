import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { TestGraphAccess } from '@e2e/types/globals'

// Repro lifted from #bug-dump (Jedrzej Kosinski, 2026-04-21): `multi_select`
// combo widgets declared with `ComfyUI_devtools`'s `DevToolsMultiSelectNode`
// never render as a multi-select control in Nodes 2.0. Vue Nodes routes
// ComponentWidget instances (widget.type === 'custom', no DOM element) to
// `WidgetLegacy`, which expects a canvas `draw` callback the component widget
// does not provide — so the node renders a blank canvas widget instead of
// PrimeVue's MultiSelect.
const multiSelectWorkflow: ComfyWorkflowJSON = {
  id: 'fe-233-multi-select-regression',
  revision: 0,
  last_node_id: 1,
  last_link_id: 0,
  nodes: [
    {
      id: 1,
      type: 'DevToolsMultiSelectNode',
      pos: [200, 200],
      size: [360, 140],
      flags: {},
      order: 0,
      mode: 0,
      inputs: [],
      outputs: [
        {
          name: 'STRING',
          type: 'STRING',
          links: null
        }
      ],
      properties: { 'Node name for S&R': 'DevToolsMultiSelectNode' },
      widgets_values: [[]]
    }
  ],
  links: [],
  groups: [],
  config: {},
  extra: {},
  version: 0.4
}

test.describe(
  'FE-233 multi_select combo regression',
  { tag: ['@vue-nodes', '@regression'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadGraphData(multiSelectWorkflow)
      await comfyPage.vueNodes.waitForNodes(1)
    })

    test('renders an interactive multi-select widget and accepts multiple values', async ({
      comfyPage
    }) => {
      const node = comfyPage.vueNodes.getNodeByTitle('Multi Select Node')

      // The multi_select widget must surface as an interactive control with
      // an ARIA role. In the broken state Vue Nodes renders this as a legacy
      // canvas widget (no role, no accessible options), so the listbox-style
      // trigger never appears.
      const trigger = node
        .getByRole('combobox', { name: 'foo', exact: true })
        .or(node.getByRole('listbox', { name: 'foo', exact: true }))
      await expect(trigger.first()).toBeVisible({ timeout: 3000 })
      await trigger.first().click()

      await comfyPage.page
        .getByRole('option', { name: 'A', exact: true })
        .click()
      await comfyPage.page
        .getByRole('option', { name: 'B', exact: true })
        .click()
      await comfyPage.page.keyboard.press('Escape')

      // Underlying widget value must be an array holding both selections.
      // In the broken state the value is either untouched (empty array / no
      // widget) or collapses to a single string under single-select semantics.
      const widgetValue = await comfyPage.page.evaluate(() => {
        const graph = window.graph as unknown as TestGraphAccess | undefined
        if (!graph) return null
        const multiSelectNode = Object.values(graph._nodes_by_id).find(
          (n) => n.type === 'DevToolsMultiSelectNode'
        )
        return multiSelectNode?.widgets?.[0]?.value ?? null
      })

      expect(Array.isArray(widgetValue)).toBe(true)
      expect(widgetValue).toEqual(expect.arrayContaining(['A', 'B']))
    })
  }
)
