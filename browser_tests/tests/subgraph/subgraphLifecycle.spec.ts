import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../../fixtures/ComfyPage'
import { TestIds } from '../../fixtures/selectors'
import { getPseudoPreviewWidgets } from '../../helpers/promotedWidgets'

const domPreviewSelector = '.image-preview'

test.describe('Subgraph Lifecycle', { tag: ['@subgraph'] }, () => {
  test.describe('Cleanup Behavior After Promoted Source Removal', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    })

    test('Deleting the promoted source removes the exterior DOM widget', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-promoted-text-widget'
      )
      await comfyPage.nextFrame()

      const textarea = comfyPage.page.getByTestId(
        TestIds.widgets.domWidgetTextarea
      )
      await expect(textarea).toBeVisible()

      const subgraphNode = await comfyPage.nodeOps.getNodeRefById('11')
      await subgraphNode.navigateIntoSubgraph()

      const clipNode = await comfyPage.nodeOps.getNodeRefById('10')
      await clipNode.delete()

      await comfyPage.subgraph.exitViaBreadcrumb()

      await expect(
        comfyPage.page.getByTestId(TestIds.widgets.domWidgetTextarea)
      ).toHaveCount(0)
    })
  })

  test.describe('Unpack/Remove Cleanup for Pseudo-Preview Targets', () => {
    test('Unpacking the preview subgraph clears promoted preview state and DOM', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-preview-node'
      )
      await comfyPage.nextFrame()

      const beforePseudo = await getPseudoPreviewWidgets(comfyPage, '5')
      expect(beforePseudo.length).toBeGreaterThan(0)

      await comfyPage.page.evaluate(() => {
        const graph = window.app!.graph!
        const subgraphNode = graph.getNodeById('5')
        if (!subgraphNode || !subgraphNode.isSubgraphNode()) return
        graph.unpackSubgraph(subgraphNode)
      })
      await comfyPage.nextFrame()

      await expect
        .poll(async () => comfyPage.subgraph.countGraphPseudoPreviewEntries())
        .toBe(0)
      await expect(comfyPage.page.locator(domPreviewSelector)).toHaveCount(0)
    })

    test('Removing the preview subgraph clears promoted preview state and DOM', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-preview-node'
      )
      await comfyPage.nextFrame()

      const beforePseudo = await getPseudoPreviewWidgets(comfyPage, '5')
      expect(beforePseudo.length).toBeGreaterThan(0)

      const subgraphNode = await comfyPage.nodeOps.getNodeRefById('5')
      expect(await subgraphNode.exists()).toBe(true)

      await subgraphNode.delete()

      expect(await subgraphNode.exists()).toBe(false)

      await expect
        .poll(async () => comfyPage.subgraph.countGraphPseudoPreviewEntries())
        .toBe(0)
      await expect(comfyPage.page.locator(domPreviewSelector)).toHaveCount(0)
    })
  })
})
