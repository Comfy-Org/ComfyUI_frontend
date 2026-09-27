import { expect } from '@playwright/test'

import type { ObjectInfoResponse } from '@/schemas/nodeDefSchema'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { routeObjectInfoFromSetupApi } from '@e2e/fixtures/utils/objectInfo'
import { PropertiesPanelHelper } from '@e2e/tests/propertiesPanel/PropertiesPanelHelper'

test.describe('Properties panel - Info tab', () => {
  let panel: PropertiesPanelHelper

  test.beforeEach(async ({ comfyPage }) => {
    panel = new PropertiesPanelHelper(comfyPage.page)
    await comfyPage.actionbar.propertiesButton.click()
    await comfyPage.nodeOps.selectNodes(['KSampler'])
    await panel.switchToTab('Info')
  })

  test('should show node help content', async () => {
    await expect(panel.contentArea).toBeVisible()
    await expect(
      panel.contentArea.getByRole('heading', { name: 'Inputs' })
    ).toBeVisible()
  })
})

test.describe('Properties panel - Info tab dynamic combo inputs', () => {
  const NODE_TYPE = 'DevToolsNodeWithStringInput'
  const NODE_TITLE = 'Node With String Input'
  const NESTED_ADVANCED_INPUT_NAME = 'nested_advanced_param'
  const ADVANCED_INPUT_TOOLTIP =
    'Tooltip only reachable through the dynamic combo option.'

  function addAdvancedDynamicComboInput(objectInfo: ObjectInfoResponse) {
    const nodeInfo = objectInfo[NODE_TYPE]
    if (!nodeInfo?.input) {
      throw new Error(`Missing object_info entry for ${NODE_TYPE}`)
    }

    nodeInfo.input.optional = {
      ...nodeInfo.input.optional,
      model: [
        'COMFY_DYNAMICCOMBO_V3',
        {
          options: [
            {
              key: 'opt-a',
              inputs: {
                optional: {
                  [NESTED_ADVANCED_INPUT_NAME]: [
                    'INT',
                    { advanced: true, tooltip: ADVANCED_INPUT_TOOLTIP }
                  ]
                }
              }
            }
          ]
        }
      ]
    }
  }

  test(
    'lists a dynamic combo option advanced input with its tooltip',
    { tag: '@screenshot' },
    async ({ comfyPage }) => {
      const unrouteObjectInfo = await routeObjectInfoFromSetupApi(
        comfyPage.page,
        addAdvancedDynamicComboInput
      )
      // Reload so the node definition store boots from the patched object_info.
      await comfyPage.workflow.reloadAndWaitForApp()
      await comfyPage.workflow.loadWorkflow('inputs/string_input')

      const panel = new PropertiesPanelHelper(comfyPage.page)
      await comfyPage.actionbar.propertiesButton.click()

      // The workflow's only node sits at (15, 48), close enough to the canvas
      // origin that its title bar renders under the fixed top toolbar at the
      // default view offset/scale. Center on it first so the title-click below
      // (used by selectNodes) actually lands on the node instead of the
      // toolbar. See BuilderSelectHelper.selectInputWidget for the same pattern.
      const [nodeRef] = await comfyPage.nodeOps.getNodeRefsByTitle(NODE_TITLE)
      if (!nodeRef) throw new Error(`Node ${NODE_TITLE} not found`)
      await nodeRef.centerOnNode()

      await comfyPage.nodeOps.selectNodes([NODE_TITLE])
      await panel.switchToTab('Info')

      try {
        await expect(
          panel.contentArea.getByRole('cell', {
            name: NESTED_ADVANCED_INPUT_NAME
          })
        ).toBeVisible()
        await expect(
          panel.contentArea.getByRole('cell', { name: ADVANCED_INPUT_TOOLTIP })
        ).toBeVisible()
        await expect(panel.contentArea).toHaveScreenshot(
          'info-tab-dynamic-combo-advanced-input.png'
        )
      } finally {
        await unrouteObjectInfo()
      }
    }
  )
})
