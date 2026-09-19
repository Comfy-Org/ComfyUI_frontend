import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import {
  getPromotedWidgetCount,
  getPromotedWidgetNames
} from '@e2e/fixtures/utils/promotedWidgets'

/**
 * Rewiring the interior node behind a subgraph's promoted input (disconnect
 * the interior widget's link, then reconnect it) fires `SubgraphInput`'s
 * unconditional `input-disconnected` event before the reconnect resolves.
 * `SubgraphNode`'s handler (`_addSubgraphInputListeners`,
 * src/lib/litegraph/src/subgraph/SubgraphNode.ts ~325-354) demotes the
 * promoted widget synchronously and only defers the widget-value-store
 * cleanup via `queueMicrotask`, leaving a window where the live widget list
 * and the reactive store disagree about whether the widget still exists.
 *
 * Three related regression reports trace back to this handler:
 * - the promoted widget itself is wiped out by the rewire, with nothing
 *   else promoted to keep it alive.
 * - rewiring one promoted "prompt" widget while other promoted widgets
 *   exist on the same host duplicates those other widgets.
 * - rewiring a promoted "width" widget makes it disappear (a subsequent
 *   redo can also misplace the wire — not covered here).
 *
 * All three tests below are pinned with `test.fail()`: they document the
 * current (buggy) behavior and should start passing once the handler is
 * fixed to resolve synchronously against the actual post-reconnect state
 * instead of demoting first and re-resolving later.
 */
test.describe(
  'Subgraph promoted widget corruption on interior rewire',
  { tag: ['@subgraph', '@widget', '@vue-nodes'] },
  () => {
    test('Rewiring the sole interior widget behind a promoted input does not survive the rewire', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-promoted-text-widget'
      )

      const hostId = '11'
      const hostNode = comfyPage.vueNodes.getNodeLocator(hostId)
      await expect(hostNode).toBeVisible()

      await expect.poll(() => getPromotedWidgetCount(comfyPage, hostId)).toBe(1)
      const promptWidget = hostNode.getByRole('textbox', {
        name: 'text',
        exact: true
      })
      await expect(promptWidget).toBeVisible()

      await comfyPage.vueNodes.enterSubgraph(hostId)
      const interiorSource = await comfyPage.nodeOps.getNodeRefById('10')
      await comfyPage.subgraph.rebindPromotedInput(interiorSource, 'text')
      await comfyPage.subgraph.exitViaBreadcrumb()

      await test.info().attach('sole-promoted-widget-after-rewire.png', {
        body: await hostNode.screenshot(),
        contentType: 'image/png'
      })

      // Structure first, while a failure here is still unexpected: the host
      // must still exist as a subgraph node at all.
      await expect(hostNode).toBeVisible()

      // Below is the known defect: the sole promoted widget is demoted by
      // the unconditional `input-disconnected` handler and never comes back,
      // even though the interior source is reconnected to the exact same
      // slot moments later.
      test.fail()
      await expect.poll(() => getPromotedWidgetCount(comfyPage, hostId)).toBe(1)
      await expect(promptWidget).toBeVisible()
    })

    test('Rewiring one promoted prompt widget duplicates other promoted widgets on the same host', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-three-promoted-widgets'
      )

      const hostId = '11'
      const hostNode = comfyPage.vueNodes.getNodeLocator(hostId)
      await expect(hostNode).toBeVisible()

      await expect
        .poll(() => getPromotedWidgetNames(comfyPage, hostId))
        .toEqual(expect.arrayContaining(['text', 'text_1', 'text_2']))
      const siblingOne = hostNode.getByRole('textbox', {
        name: 'text_1',
        exact: true
      })
      const siblingTwo = hostNode.getByRole('textbox', {
        name: 'text_2',
        exact: true
      })
      await expect(siblingOne).toHaveCount(1)
      await expect(siblingTwo).toHaveCount(1)

      await comfyPage.vueNodes.enterSubgraph(hostId)
      // Node 10 feeds the "text" promoted input; "text_1"/"text_2" are fed by
      // separate, untouched interior CLIPTextEncode nodes.
      const interiorSource = await comfyPage.nodeOps.getNodeRefById('10')
      await comfyPage.subgraph.rebindPromotedInput(interiorSource, 'text')
      await comfyPage.subgraph.exitViaBreadcrumb()

      await test.info().attach('duplicated-sibling-widgets-after-rewire.png', {
        body: await hostNode.screenshot(),
        contentType: 'image/png'
      })

      // Structure first, while a failure here is still unexpected: the host
      // still exists and the graph model still reports exactly three
      // promoted slots (duplication does not add a fourth slot; it
      // duplicates a widget's rendered DOM within one existing slot).
      await expect(hostNode).toBeVisible()
      await expect.poll(() => getPromotedWidgetCount(comfyPage, hostId)).toBe(3)

      // Below is the known defect: rewiring "text" leaves the untouched
      // sibling widgets "text_1"/"text_2" rendered more than once.
      test.fail()
      await expect(siblingOne).toHaveCount(1)
      await expect(siblingTwo).toHaveCount(1)
    })

    test('Rewiring a promoted "width" widget makes it disappear', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-legacy-reordered-links'
      )

      const hostId = '2'
      const hostNode = comfyPage.vueNodes.getNodeLocator(hostId)
      await expect(hostNode).toBeVisible()

      await expect
        .poll(() => getPromotedWidgetNames(comfyPage, hostId))
        .toEqual(expect.arrayContaining(['width', 'batch_size']))
      const widthWidget = hostNode.getByLabel('width', { exact: true })
      await expect(widthWidget).toBeVisible()

      await comfyPage.vueNodes.enterSubgraph(hostId)
      // Both "width" and "batch_size" are fed by the same interior
      // EmptyLatentImage node, but through independent subgraph input slots;
      // only "width" is rewired here.
      const interiorSource = await comfyPage.nodeOps.getNodeRefById('1')
      await comfyPage.subgraph.rebindPromotedInput(interiorSource, 'width')
      await comfyPage.subgraph.exitViaBreadcrumb()

      await test.info().attach('width-widget-after-rewire.png', {
        body: await hostNode.screenshot(),
        contentType: 'image/png'
      })

      // Structure first, while a failure here is still unexpected: the
      // untouched sibling "batch_size" must still be promoted regardless of
      // what happens to "width".
      await expect(hostNode).toBeVisible()
      await expect
        .poll(() => getPromotedWidgetNames(comfyPage, hostId))
        .toEqual(expect.arrayContaining(['batch_size']))

      // Below is the known defect: rewiring "width"'s own interior link
      // demotes it and it never comes back, even though the interior source
      // reconnects to the exact same slot moments later.
      test.fail()
      await expect
        .poll(() => getPromotedWidgetNames(comfyPage, hostId))
        .toEqual(expect.arrayContaining(['width', 'batch_size']))
      await expect(widthWidget).toBeVisible()
    })
  }
)
