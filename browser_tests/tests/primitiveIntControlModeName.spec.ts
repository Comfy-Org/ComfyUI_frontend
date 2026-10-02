import { expect } from '@playwright/test'

import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'

import { comfyPageFixture as base } from '@e2e/fixtures/ComfyPage'
import { PropertiesPanelHelper } from '@e2e/tests/propertiesPanel/PropertiesPanelHelper'

const NODE_TYPE = 'PrimitiveIntModeNameProbe'
const nodeDef: ComfyNodeDef = {
  name: NODE_TYPE,
  display_name: 'Primitive Int Mode Name Probe',
  description: '',
  category: 'testing',
  python_module: 'browser_tests',
  output_node: false,
  input: {
    required: {
      value: [
        'INT',
        {
          default: 0,
          min: 0,
          max: 100,
          control_after_generate: 'fixed'
        }
      ]
    }
  },
  output: ['INT'],
  output_name: ['INT'],
  output_is_list: [false]
}

const test = base.extend<{ mockModeNode: void }>({
  mockModeNode: [
    async ({ page }, use) => {
      await page.route('**/api/object_info', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ [NODE_TYPE]: nodeDef })
        })
      )
      await use()
    },
    { auto: true }
  ]
})

test(
  'shows a mode-valued control under its canonical name',
  { tag: ['@node', '@widget'] },
  async ({ comfyPage }) => {
    await comfyPage.nodeOps.addNode(NODE_TYPE)
    await comfyPage.nodeOps.selectNodes(['Primitive Int Mode Name Probe'])
    await comfyPage.actionbar.propertiesButton.click()

    const panel = new PropertiesPanelHelper(comfyPage.page)
    await expect(panel.panelTitle).toContainText(
      'Primitive Int Mode Name Probe'
    )
    await expect(
      panel.contentArea.getByRole('button', { name: 'Fixed Value' })
    ).toBeVisible()

    const savedNode = (await comfyPage.nodeOps.getSerializedGraph()).nodes.find(
      (node) => node.type === NODE_TYPE
    )
    if (!savedNode) throw new Error('mode-name probe node was not saved')
    expect(savedNode.widgets_values_named).toEqual({
      value: 0,
      control_after_generate: 'fixed'
    })
  }
)
