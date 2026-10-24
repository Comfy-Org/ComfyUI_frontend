import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import {
  getPromotedWidgetCountByName,
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
 * Only the "duplicates other promoted widgets" case below reproduces
 * through a real mouse-driven rebind and is pinned with `test.fail()`; it
 * documents the current (buggy) behavior and should start passing once the
 * handler is fixed to resolve synchronously against the actual
 * post-reconnect state instead of demoting first and re-resolving later.
 * The other two cases ("sole widget", "width") do not reproduce that way —
 * the disconnect and reconnect naturally span enough task-queue turns for
 * the widget to self-heal before anything observes it missing — so they
 * are asserted as normal passing tests instead.
 *
 * A fourth, unrelated open bug: `createPromotedMultilineWidget`
 * (src/renderer/extensions/vueNodes/widgets/utils/multilineTextarea.ts)
 * builds its promoted textarea DOM widget without aliasing the widget's
 * private `_visibility` to the `WidgetValueStore` entry already registered
 * under the same widget id, so `suppression.byConnection` changes made
 * through the store (e.g. via `createPromotedWidgetStoreProjection`) never
 * reach the textarea's own `connectionSuppressed`/`hidden` getters. Two fix
 * attempts — aliasing via `BaseWidget.setNodeId()`, then a narrower
 * `aliasVisibility()` that skips `setNodeId()`'s state re-registration —
 * both caused widespread, unrelated regressions across
 * subgraphNested/Promotion/ResizePreservation/Serialization e2e tests, so
 * both were reverted (commit 8dd0f43) rather than shipped. The visibility
 * bug remains open and unfixed.
 */
test.describe(
  'Subgraph promoted widget corruption on interior rewire',
  { tag: ['@subgraph', '@widget', '@vue-nodes'] },
  () => {
    test('Rewiring the sole interior widget behind a promoted input survives the rewire in practice', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-promoted-text-widget'
      )

      const hostId = '11'
      const hostNode = comfyPage.vueNodes.getNodeLocator(hostId)
      await expect(hostNode).toBeVisible()

      // This host also carries an unrelated "$$canvas-image-preview" preview
      // exposure, so the total promoted count is 2; scope to "text" alone.
      await expect
        .poll(() => getPromotedWidgetCountByName(comfyPage, hostId, 'text'))
        .toBe(1)
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

      await expect(hostNode).toBeVisible()

      // The `input-disconnected` handler demotes the sole promoted widget
      // synchronously on disconnect, but a real mouse-driven drag-and-drop
      // reconnect spans enough task-queue turns for `input-connected` to
      // re-resolve it before anything observes it missing, so it reliably
      // comes back.
      await expect
        .poll(() => getPromotedWidgetCountByName(comfyPage, hostId, 'text'))
        .toBe(1)
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

      // getPromotedWidgetNames reflects each promoted slot's *interior*
      // source widget name, which is "text" for every CLIPTextEncode node
      // regardless of the host's disambiguated text/text_1/text_2 slot
      // names — scope by count instead of asserting on those names.
      await expect
        .poll(() => getPromotedWidgetCountByName(comfyPage, hostId, 'text'))
        .toBe(3)
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
      await expect
        .poll(() => getPromotedWidgetCountByName(comfyPage, hostId, 'text'))
        .toBe(3)

      // Below is the known defect: rewiring "text" leaves the untouched
      // sibling widgets "text_1"/"text_2" rendered more than once.
      test.fail()
      await expect(siblingOne).toHaveCount(1)
      await expect(siblingTwo).toHaveCount(1)
    })

    test('Rewiring a promoted "width" widget survives the rewire in practice', async ({
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

      // The `input-disconnected` handler demotes "width" synchronously on
      // disconnect, but a real mouse-driven drag-and-drop reconnect spans
      // enough task-queue turns for `input-connected` to re-resolve it
      // before anything observes it missing, so it reliably comes back.
      await expect
        .poll(() => getPromotedWidgetNames(comfyPage, hostId))
        .toEqual(expect.arrayContaining(['width', 'batch_size']))
      await expect(widthWidget).toBeVisible()
    })
  }
)
