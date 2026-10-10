import {
  comfyExpect as expect,
  comfyPageFixture as baseTest
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  AUTOGROW_THEN_MASK_NODE_TITLE,
  AUTOGROW_THEN_MASK_NODE_TYPE,
  autogrowThenMaskNodeDef
} from '@e2e/fixtures/data/autogrowThenMaskNodeDef'
import { getInputNames } from '@e2e/fixtures/utils/nodeInputLinks'
import { routeObjectInfoFromSetupApi } from '@e2e/fixtures/utils/objectInfo'
import { toNodeId } from '@/types/nodeId'

const SOURCE_NODE_ID = '1'
const AUTOGROW_NODE_ID = '2'

const EXPECTED_CONNECTIONS = {
  'images.image0': 'IMAGE',
  'images.image1': 'IMAGE',
  'images.image2': 'IMAGE',
  mask: 'MASK'
}

const test = baseTest.extend({
  page: async ({ page }, use) => {
    const unrouteObjectInfo = await routeObjectInfoFromSetupApi(
      page,
      (objectInfo) => {
        objectInfo[AUTOGROW_THEN_MASK_NODE_TYPE] = autogrowThenMaskNodeDef
      }
    )
    try {
      await use(page)
    } finally {
      await unrouteObjectInfo()
    }
  }
})

/**
 * Connects the source's IMAGE to three autogrow slots (growing the group past
 * its default size) and its MASK to `mask`. Built here rather than saved in the
 * workflow so the grown slots keep their live order ahead of `mask`.
 */
async function connectGrownGroupAndMask(comfyPage: ComfyPage): Promise<void> {
  await comfyPage.page.evaluate(
    ({ sourceId, targetId }) => {
      const graph = window.app!.graph
      const source = graph.getNodeById(sourceId)
      const target = graph.getNodeById(targetId)
      if (!source || !target) throw new Error('Workflow nodes not found')
      const slotOf = (name: string) =>
        target.inputs.findIndex((input) => input.name === name)
      for (const name of ['images.image0', 'images.image1', 'images.image2'])
        source.connect(0, target, slotOf(name))
      source.connect(1, target, slotOf('mask'))
    },
    { sourceId: toNodeId(SOURCE_NODE_ID), targetId: toNodeId(AUTOGROW_NODE_ID) }
  )
}

/** Connected inputs of the root-graph autogrow node, as `name -> link type`. */
async function rootConnections(
  comfyPage: ComfyPage
): Promise<Record<string, string>> {
  return comfyPage.page.evaluate((nodeId) => {
    const node = window.app!.graph.getNodeById(nodeId)
    if (!node) throw new Error(`Node ${nodeId} not found`)
    return Object.fromEntries(
      node.inputs.flatMap((input, slot) => {
        const link = node.getInputLink(slot)
        return link ? [[input.name, String(link.type)]] : []
      })
    )
  }, toNodeId(AUTOGROW_NODE_ID))
}

/** Connected inputs of the autogrow node inside the new subgraph. */
async function innerConnections(
  comfyPage: ComfyPage,
  subgraphNodeId: string
): Promise<Record<string, string>> {
  return comfyPage.page.evaluate(
    ({ subgraphNodeId, nodeType }) => {
      const subgraphNode = window.app!.graph.getNodeById(subgraphNodeId)
      if (!subgraphNode?.isSubgraphNode())
        throw new Error(`Expected subgraph node ${subgraphNodeId}`)
      const inner = subgraphNode.subgraph.nodes.find(
        (node) => node.type === nodeType
      )
      if (!inner) throw new Error('Autogrow node not found in the subgraph')
      return Object.fromEntries(
        inner.inputs.flatMap((input, slot) => {
          const link = inner.getInputLink(slot)
          return link ? [[input.name, String(link.type)]] : []
        })
      )
    },
    {
      subgraphNodeId: toNodeId(subgraphNodeId),
      nodeType: AUTOGROW_THEN_MASK_NODE_TYPE
    }
  )
}

test.describe(
  'Convert to Subgraph with a grown autogrow group (FE-3325)',
  { tag: ['@subgraph', '@node'] },
  () => {
    test.use({ initialSettings: { 'Comfy.Canvas.SelectionToolbox': true } })

    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('subgraphs/autogrow-then-mask')
      await connectGrownGroupAndMask(comfyPage)
    })

    test('the grown group sits ahead of mask before conversion', async ({
      comfyPage
    }) => {
      await expect
        .poll(() => getInputNames(comfyPage, AUTOGROW_NODE_ID, ''))
        .toEqual([
          'images.image0',
          'images.image1',
          'images.image2',
          'images.image3',
          'mask'
        ])
      await expect
        .poll(() => rootConnections(comfyPage))
        .toEqual(EXPECTED_CONNECTIONS)
    })

    // FE-3325 repro only - no fix ships here. `multiClone` round-trips the
    // node through a fresh, graph-less node whose default autogrow layout
    // makes `ComfyNode.configure` append the grown slots after `mask`, and
    // drops the serialized link ids. The subgraph's links keep their original
    // slot indices, so the image2 link lands on `mask` and the mask link on
    // `image3`. Remove `test.fail()` once Convert to Subgraph is fixed.
    test('keeps every link on its input inside the subgraph', async ({
      comfyPage
    }) => {
      test.fail()

      await comfyPage.nodeOps.selectNodes([AUTOGROW_THEN_MASK_NODE_TITLE])
      const subgraphNodeId =
        await comfyPage.subgraph.convertSelectionToSubgraph()

      expect(await innerConnections(comfyPage, subgraphNodeId)).toEqual(
        EXPECTED_CONNECTIONS
      )
    })
  }
)
