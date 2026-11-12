import { expect } from '@playwright/test'

import { WidgetSelectDefaultFixture } from '@e2e/fixtures/components/WidgetSelectDefault'
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

test.describe(
  'Promoted dynamic combo',
  { tag: ['@subgraph', '@widget', '@vue-nodes'] },
  () => {
    const INTERIOR_ID = '1'
    const COMBO = 'resize_type'
    const DIMENSION_INPUTS = [
      COMBO,
      `${COMBO}.width`,
      `${COMBO}.height`,
      `${COMBO}.crop`
    ]

    test('moves its option inputs to the subgraph node until it is disconnected', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('inputs/dynamic_combo')
      const resizeNode = await comfyPage.nodeOps.getNodeRefById(INTERIOR_ID)
      await resizeNode.click('title')
      const hostId = String((await resizeNode.convertToSubgraph()).id)
      const host = comfyPage.vueNodes.getNodeLocator(hostId)
      const interior = comfyPage.vueNodes.getNodeLocator(INTERIOR_ID)
      const hostCombo = new WidgetSelectDefaultFixture(host, COMBO)
      const interiorCombo = new WidgetSelectDefaultFixture(interior, COMBO)

      await test.step('promote the combo from inside the subgraph', async () => {
        await comfyPage.vueNodes.enterSubgraph(hostId)
        await comfyPage.subgraph.promoteWidget(interior, COMBO)
        await expect
          .poll(() => getInputNames(comfyPage, INTERIOR_ID, COMBO))
          .toEqual([COMBO])
        await comfyPage.subgraph.exitViaBreadcrumb()

        await expect(hostCombo.trigger).toHaveText('scale dimensions')
        await expect
          .poll(() => getInputNames(comfyPage, hostId, COMBO))
          .toEqual(DIMENSION_INPUTS)
      })

      await test.step('select another option on the subgraph node', async () => {
        await hostCombo.selectOption('scale by multiplier')

        await expect
          .poll(() => getInputNames(comfyPage, hostId, COMBO))
          .toEqual([COMBO, `${COMBO}.multiplier`])
      })

      await test.step('disconnect the promoted input', async () => {
        await comfyPage.vueNodes.enterSubgraph(hostId)
        await comfyPage.subgraph.rightClickInputSlot(COMBO)
        await comfyPage.contextMenu.clickLitegraphMenuItem('Disconnect Links')

        await expect
          .poll(() => getInputNames(comfyPage, INTERIOR_ID, COMBO))
          .toEqual(DIMENSION_INPUTS)
        await expect(interiorCombo.trigger).toHaveText('scale dimensions')
        await expect(
          comfyPage.vueNodes.getInputNumberControls(
            comfyPage.vueNodes.getWidgetRowByLabel(interior, 'width')
          ).input
        ).toHaveValue('512')

        await comfyPage.subgraph.exitViaBreadcrumb()
        await expect(hostCombo.trigger).toHaveCount(0)
        await expect
          .poll(() => getInputNames(comfyPage, hostId, COMBO))
          .toEqual([COMBO])
      })
    })
  }
)
