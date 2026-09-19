import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import type { NodeReference } from '@e2e/fixtures/utils/litegraphUtils'

// Reported (Jo Zhang / Christian Byrne): when the in-app AI agent (or a
// manual drag) wires a new node into a subgraph's promoted "prompt" widget,
// the subgraph host's *other* promoted widgets (width/height/seed) render
// duplicated above the prompt box. A sibling symptom (PM-1253/PM-1254): the
// rewired widget itself disappears, and redo misplaces the wire. Undo always
// restores a correct single-widget display, because it fully reloads the
// node from a snapshot.
//
// Linear: PM-1328 (this bug), PM-1253 (parent), PM-1254 (sibling: int node ->
// width).
//
// Two candidate trigger paths are covered as separate scenarios, since they
// go through different code:
//  - Interior rewire: rebinding the link feeding the interior node *behind*
//    the promoted widget, from inside the subgraph
//    (SubgraphInputNode._disconnectNodeInput -> SubgraphNode's
//    'input-disconnected' handler, src/lib/litegraph/src/subgraph/
//    SubgraphNode.ts:325-354 / SubgraphInputNode.ts:173-234).
//  - External boundary wire: dragging a brand-new node directly onto the
//    SubgraphNode's own exposed widget socket from the parent graph -- the
//    literal action in the bug report ("wire a text node into the
//    subgraph's prompt widget"). This does not go through
//    SubgraphNode._setWidget/ensureWidgetRemoved at all (SubgraphNode has no
//    onConnectInput/onConnectionsChange override), so it is a genuinely
//    different code path from the interior-rewire case above.
//
// Caveat for the undo tests: the change tracker does not capture a Vue slot
// drag-connect (useSlotLinkInteraction.ts preventDefault()s pointerdown,
// which suppresses the mouseup capture changeTracker.ts relies on), so the
// wire action itself may not create its own undo snapshot -- undo may
// restore an earlier snapshot than the one these tests assume. If an undo
// assertion here fails unexpectedly, check which snapshot undo actually
// targeted before blaming the widget-promotion code.

const KSAMPLER_ID = '3'
const EMPTY_LATENT_ID = '5'
const POSITIVE_CLIP_ID = '6'

const PROMOTED_WIDGET_NAMES = ['text', 'seed', 'width', 'height'] as const

/** Builds a subgraph with 4 promoted widgets from 3 different node types:
 * 'text' (CLIPTextEncode, the promoted "prompt"), 'seed' (KSampler), and
 * 'width'/'height' (EmptyLatentImage) -- the exact widget mix from the bug
 * report. */
async function buildBaselineSubgraph(comfyPage: ComfyPage): Promise<string> {
  await comfyPage.workflow.loadWorkflow('default')

  await comfyPage.page.keyboard.down('Control')
  try {
    for (const id of [KSAMPLER_ID, EMPTY_LATENT_ID, POSITIVE_CLIP_ID]) {
      const node = await comfyPage.nodeOps.getNodeRefById(id)
      await node.click('title')
    }
  } finally {
    await comfyPage.page.keyboard.up('Control')
    await comfyPage.nextFrame()
  }

  const subgraphNodeId = await comfyPage.subgraph.convertSelectionToSubgraph()

  // 'seed' (name match) and every CLIPTextEncode widget (node-type match)
  // are auto-promoted as "recommended" on conversion; width/height are not,
  // so promote them explicitly to match the real-world reported workflow.
  await comfyPage.vueNodes.enterSubgraph(subgraphNodeId)
  const emptyLatent = comfyPage.vueNodes.getNodeLocator(EMPTY_LATENT_ID)
  await comfyPage.subgraph.promoteWidget(emptyLatent, 'width')
  await comfyPage.subgraph.promoteWidget(emptyLatent, 'height')
  await comfyPage.subgraph.exitViaBreadcrumb()

  await expectSingleRenderedWidgetOfEach(comfyPage, subgraphNodeId)
  return subgraphNodeId
}

function widgetLocators(comfyPage: ComfyPage, subgraphNodeId: string) {
  const node = comfyPage.vueNodes.getNodeLocator(subgraphNodeId)
  return PROMOTED_WIDGET_NAMES.map(
    (name) => [name, node.getByLabel(name, { exact: true })] as const
  )
}

/** The bug's core, verifiable symptom: after any rewire behind one promoted
 * widget, every promoted widget -- including the ones nothing touched --
 * must still render exactly once. */
async function expectSingleRenderedWidgetOfEach(
  comfyPage: ComfyPage,
  subgraphNodeId: string
) {
  for (const [name, locator] of widgetLocators(comfyPage, subgraphNodeId)) {
    await expect(
      locator,
      `"${name}" widget should render exactly once`
    ).toHaveCount(1)
  }
}

test.describe(
  'Subgraph promoted widget duplication on rewire (PM-1328 / PM-1253 / PM-1254)',
  { tag: ['@subgraph', '@widget', '@vue-nodes'] },
  () => {
    test.use({ initialSettings: { 'Comfy.Canvas.SelectionToolbox': true } })

    test.describe('Interior rewire (rebinding the link behind the promoted widget)', () => {
      test('keeps sibling promoted widgets rendered exactly once on the subgraph host', async ({
        comfyPage
      }) => {
        const subgraphNodeId = await buildBaselineSubgraph(comfyPage)

        await comfyPage.vueNodes.enterSubgraph(subgraphNodeId)
        const [interiorClip] = await comfyPage.nodeOps.getNodeRefsByType(
          'CLIPTextEncode',
          true
        )
        await comfyPage.subgraph.rebindPromotedInput(interiorClip, 'text')
        await comfyPage.subgraph.exitViaBreadcrumb()

        await expectSingleRenderedWidgetOfEach(comfyPage, subgraphNodeId)
      })

      test('undo restores exactly one of each promoted widget', async ({
        comfyPage
      }) => {
        const subgraphNodeId = await buildBaselineSubgraph(comfyPage)

        await comfyPage.vueNodes.enterSubgraph(subgraphNodeId)
        const [interiorClip] = await comfyPage.nodeOps.getNodeRefsByType(
          'CLIPTextEncode',
          true
        )
        await comfyPage.subgraph.rebindPromotedInput(interiorClip, 'text')
        await comfyPage.subgraph.exitViaBreadcrumb()

        await comfyPage.keyboard.undo()
        await comfyPage.nextFrame()

        // Undo fully reloads the node from a snapshot (ChangeTracker ->
        // app.loadGraphData -> SubgraphNode.configure), so this must pass
        // even though the rewire itself (above) does not.
        await expectSingleRenderedWidgetOfEach(comfyPage, subgraphNodeId)
      })
    })

    test.describe("External boundary wire (new node onto the host node's promoted widget socket)", () => {
      test('keeps sibling promoted widgets rendered exactly once on the subgraph host', async ({
        comfyPage
      }) => {
        const subgraphNodeId = await buildBaselineSubgraph(comfyPage)

        const subgraphNodeRef: NodeReference =
          await comfyPage.nodeOps.getNodeRefById(subgraphNodeId)
        const textWidgetIndex = (await subgraphNodeRef.getWidgetByName('text'))
          .index

        const source: NodeReference = await comfyPage.nodeOps.addNode(
          'PrimitiveNode',
          {},
          { x: 100, y: 800 }
        )
        await comfyPage.nextFrame()

        // The literal user/agent action from the bug report: drag a new
        // node's output directly onto the SubgraphNode's own exposed
        // "prompt" widget socket, from the parent graph -- not from inside
        // the subgraph.
        await source.connectWidget(0, subgraphNodeRef, textWidgetIndex)
        await comfyPage.nextFrame()

        await expectSingleRenderedWidgetOfEach(comfyPage, subgraphNodeId)
      })

      test('undo restores exactly one of each promoted widget', async ({
        comfyPage
      }) => {
        const subgraphNodeId = await buildBaselineSubgraph(comfyPage)

        const subgraphNodeRef: NodeReference =
          await comfyPage.nodeOps.getNodeRefById(subgraphNodeId)
        const textWidgetIndex = (await subgraphNodeRef.getWidgetByName('text'))
          .index

        const source: NodeReference = await comfyPage.nodeOps.addNode(
          'PrimitiveNode',
          {},
          { x: 100, y: 800 }
        )
        await comfyPage.nextFrame()
        await source.connectWidget(0, subgraphNodeRef, textWidgetIndex)
        await comfyPage.nextFrame()

        // The drag-connect suppresses the mouseup state capture (see the
        // caveat in the header), so capture the post-connect state with a
        // plain click before undoing -- otherwise undo targets a snapshot
        // from before the width/height promotions.
        await comfyPage.canvasOps.clickEmptySpace()

        await comfyPage.keyboard.undo()
        await comfyPage.nextFrame()

        await expectSingleRenderedWidgetOfEach(comfyPage, subgraphNodeId)
      })
    })
  }
)
