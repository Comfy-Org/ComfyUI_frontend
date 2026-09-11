import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { getPromotedWidgetNames } from '@e2e/fixtures/utils/promotedWidgets'

// Reduced from the `utility_seedvr2_3b_int8_upscale_image` template (FE-258):
// a `ResizeImageMaskNode` whose `resize_type` dynamic combo is set to a
// non-default option, with that option's `multiplier` child widget promoted
// through the subgraph boundary.
const WORKFLOW = 'subgraphs/subgraph-dynamic-combo-promoted-child'
const HOST_NODE_TITLE = 'Resize Image Subgraph'
const HOST_NODE_ID = '66'
const PROMOTED_WIDGET_LABEL = 'scale_multiplier'
const PROMOTED_INPUT_NAME = 'resize_type.multiplier'

test.describe(
  'Promoted dynamic combo child widget',
  { tag: ['@subgraph', '@widget', '@vue-nodes'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    })

    test('survives a workflow load', async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow(WORKFLOW)
      await comfyPage.vueNodes.waitForNodes()

      const multiplier = comfyPage.vueNodes.getWidgetRowByLabel(
        HOST_NODE_TITLE,
        PROMOTED_WIDGET_LABEL
      )
      await expect(multiplier).toBeVisible()
      await expect(
        comfyPage.vueNodes.getInputNumberControls(multiplier).input
      ).toHaveValue('4.00')

      await expect
        .poll(() => getPromotedWidgetNames(comfyPage, HOST_NODE_ID))
        .toEqual([PROMOTED_INPUT_NAME])
    })

    test('keeps the links of the nodes around it', async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow(WORKFLOW)
      await comfyPage.vueNodes.waitForNodes()

      await expect
        .poll(() =>
          comfyPage.page.evaluate(() =>
            [...window.app!.graph.links.values()]
              .map(
                (link) =>
                  `${link.origin_id}:${link.origin_slot}->${link.target_id}:${link.target_slot}`
              )
              .sort()
          )
        )
        .toEqual(['1:0->66:0', '66:0->67:0'])
    })
  }
)
