import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import { getPromotedWidgetNames } from '@e2e/helpers/promotedWidgets'

async function ensurePropertiesPanel(comfyPage: ComfyPage) {
  const panel = comfyPage.menu.propertiesPanel.root
  if (!(await panel.isVisible())) {
    await comfyPage.actionbar.propertiesButton.click()
  }
  await expect(panel).toBeVisible()
  return panel
}

async function openSubgraphEditor(comfyPage: ComfyPage) {
  await ensurePropertiesPanel(comfyPage)
  const editorToggle = comfyPage.page.getByTestId(TestIds.subgraphEditor.toggle)
  await expect(editorToggle).toBeVisible()
  await editorToggle.click()
  const shownSection = comfyPage.page.getByTestId(
    TestIds.subgraphEditor.shownSection
  )
  await expect(shownSection).toBeVisible()
  return shownSection
}

test.describe(
  'Subgraph promoted widget ordering',
  { tag: ['@subgraph', '@widget'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    })

    test('demote then re-promote via sidebar preserves widget order', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('default')
      await comfyPage.vueNodes.waitForNodes()

      // Create a subgraph from KSampler + one CLIPTextEncode so we get at
      // least 2 auto-promoted widgets: KSampler's "seed" (in recommendedWidgetNames)
      // and CLIPTextEncode's "text" (CLIPTextEncode is in recommendedNodes).
      const nodeId = await comfyPage.page.evaluate(() => {
        const graph = window.app!.canvas.graph!
        const ksampler = graph._nodes.find((n) => n.type === 'KSampler')
        const clipEncode = graph._nodes.find((n) => n.type === 'CLIPTextEncode')
        if (!ksampler) throw new Error('KSampler not found')
        if (!clipEncode) throw new Error('CLIPTextEncode not found')
        const result = graph.convertToSubgraph(new Set([ksampler, clipEncode]))
        if (!result) throw new Error('convertToSubgraph failed')
        return String(result.node.id)
      })
      await comfyPage.nextFrame()
      await comfyPage.vueNodes.waitForNodes()

      const subgraphVueNode = comfyPage.vueNodes.getNodeLocator(nodeId)
      await expect(subgraphVueNode).toBeVisible()

      // Select the subgraph node and open SubgraphEditor sidebar
      await comfyPage.vueNodes.selectNode(nodeId)
      const shownSection = await openSubgraphEditor(comfyPage)

      // Capture initial widget order from the sidebar labels
      const labels = shownSection.getByTestId(
        TestIds.subgraphEditor.widgetLabel
      )
      const initialLabels = await labels.allTextContents()
      expect(initialLabels.length).toBeGreaterThanOrEqual(2)

      // Also capture initial order from the promotion store (source of truth)
      const initialOrder = await getPromotedWidgetNames(comfyPage, nodeId)

      // Hide the first widget via the sidebar toggle (demote)
      const toggleButtons = shownSection.getByTestId(
        TestIds.subgraphEditor.widgetToggle
      )
      await toggleButtons.first().click()

      // The hidden section should now contain the demoted widget
      const hiddenSection = comfyPage.page.getByTestId(
        TestIds.subgraphEditor.hiddenSection
      )
      await expect(hiddenSection).toBeVisible()

      // Re-show the widget via the hidden section toggle (promote)
      const hiddenToggle = hiddenSection.getByTestId(
        TestIds.subgraphEditor.widgetToggle
      )
      await hiddenToggle.first().click()

      // Verify the shown section order is restored
      await expect(labels).toHaveText(initialLabels)

      // Also verify the promotion store order matches
      const finalOrder = await getPromotedWidgetNames(comfyPage, nodeId)
      expect(finalOrder).toEqual(initialOrder)
    })
  }
)
