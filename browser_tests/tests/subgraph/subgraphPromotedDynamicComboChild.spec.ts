import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { getInputNames } from '@e2e/fixtures/utils/nodeInputLinks'
import { getPromotedWidgetNames } from '@e2e/fixtures/utils/promotedWidgets'

// Reduced from the `utility_seedvr2_3b_int8_upscale_image` template (FE-258):
// a `ResizeImageMaskNode` whose `resize_type` dynamic combo is set to a
// non-default option, with that option's `multiplier` child widget promoted
// through the subgraph boundary.
test.describe(
  'Promoted dynamic combo child widget',
  { tag: ['@subgraph', '@widget', '@vue-nodes'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-dynamic-combo-promoted-child'
      )
    })

    test('survives a workflow load', async ({ comfyPage }) => {
      const multiplier = comfyPage.vueNodes.getWidgetRowByLabel(
        'Resize Image Subgraph',
        'scale_multiplier'
      )
      await expect(multiplier).toBeVisible()
      await expect(
        comfyPage.vueNodes.getInputNumberControls(multiplier).input
      ).toHaveValue('4.00')

      await expect
        .poll(() => getPromotedWidgetNames(comfyPage, '66'))
        .toEqual(['resize_type.multiplier'])

      await expect
        .poll(() => getInputNames(comfyPage, '66', ''))
        .toEqual(['image', 'resize_type.multiplier'])
    })

    test('keeps the links of the nodes around it', async ({ comfyPage }) => {
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
