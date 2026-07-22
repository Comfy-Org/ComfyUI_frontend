import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { getPromotedWidgetNames } from '@e2e/fixtures/utils/promotedWidgets'

/**
 * Regression: BUG-003 (fixed by #13809) — nested-subgraph promoted-value reset.
 *
 * When a node inside a subgraph is converted into its own nested subgraph, the
 * value that the user set on the parent (host) subgraph node's promoted widget
 * must survive. Before the fix the host value reset to a stale interior value.
 *
 * Denys's repro: a subgraph exposes a promoted text widget showing a distinctive
 * string ("test cool value"); entering the subgraph, selecting the interior text
 * node and running "Convert Selection to Subgraph" reset the host's promoted
 * value back to the earlier interior string ("test value").
 *
 * The e2e value-add over the unit test
 * (SubgraphWidgetPromotion.test.ts > "preserves the host value when its source is
 * converted to a nested subgraph") is driving the full user path through the real
 * UI: convert to subgraph, edit the promoted DOM widget, enter, nest, exit.
 */
test.describe(
  'Subgraph nested-conversion value preservation',
  { tag: ['@subgraph', '@widget', '@vue-nodes'] },
  () => {
    const CLIP_TITLE = 'CLIP Text Encode (Prompt)'
    const HOST_TITLE = 'New Subgraph'
    const INTERIOR_VALUE = 'test value'
    const HOST_VALUE = 'test cool value'

    test('Host promoted value survives converting its interior source into a nested subgraph', async ({
      comfyPage
    }) => {
      // Arrange: give the interior text node a distinctive value, then promote
      // it onto a subgraph host node.
      const clipId = await comfyPage.vueNodes.getNodeIdByTitle(CLIP_TITLE)
      const interiorTextbox = comfyPage.vueNodes
        .getNodeLocator(clipId)
        .getByRole('textbox', { name: 'text' })
      await interiorTextbox.fill(INTERIOR_VALUE)
      await expect(interiorTextbox).toHaveValue(INTERIOR_VALUE)

      const clipFixture = await comfyPage.vueNodes.getFixtureByTitle(CLIP_TITLE)
      await comfyPage.contextMenu.openForVueNode(clipFixture.header)
      await comfyPage.contextMenu.clickMenuItemExact('Convert to Subgraph')

      const hostId = await comfyPage.vueNodes.getNodeIdByTitle(HOST_TITLE)
      await expect
        .poll(() => getPromotedWidgetNames(comfyPage, hostId))
        .toContain('text')

      // The user changes the value on the HOST promoted widget to a longer,
      // distinctive string. This is the value that must be preserved.
      const hostTextbox = comfyPage.vueNodes
        .getNodeLocator(hostId)
        .getByRole('textbox', { name: 'text' })
      await hostTextbox.fill(HOST_VALUE)
      await expect(hostTextbox).toHaveValue(HOST_VALUE)

      // Act: enter the subgraph, select the interior text node, and convert the
      // selection into a nested subgraph.
      await comfyPage.vueNodes.enterSubgraph(hostId)
      await expect.poll(() => comfyPage.subgraph.isInSubgraph()).toBe(true)
      await comfyPage.vueNodes.waitForNodes()

      const interiorFixture =
        await comfyPage.vueNodes.getFixtureByTitle(CLIP_TITLE)
      await comfyPage.contextMenu.openForVueNode(interiorFixture.header)
      await comfyPage.contextMenu.clickMenuItemExact('Convert to Subgraph')
      await expect(comfyPage.vueNodes.getNodeByTitle(HOST_TITLE)).toBeVisible()

      await comfyPage.subgraph.exitViaBreadcrumb()

      // Assert: back on the host, the promoted widget still shows the value the
      // user set — not the stale interior value it reset to before the fix.
      const hostTextboxAfter = comfyPage.vueNodes
        .getNodeLocator(hostId)
        .getByRole('textbox', { name: 'text' })
      await expect(hostTextboxAfter).toHaveValue(HOST_VALUE)
      await expect(hostTextboxAfter).not.toHaveValue(INTERIOR_VALUE)
      await expect
        .poll(() => getPromotedWidgetNames(comfyPage, hostId))
        .toContain('text')
    })
  }
)
