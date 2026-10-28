import {
  comfyExpect as expect,
  comfyPageFixture as baseTest
} from '@e2e/fixtures/ComfyPage'
import {
  AUTOGROW_THEN_MASK_NODE_TITLE,
  AUTOGROW_THEN_MASK_NODE_TYPE,
  autogrowThenMaskNodeDef
} from '@e2e/fixtures/data/autogrowThenMaskNodeDef'
import {
  AUTOGROW_NODE_ID,
  EXPECTED_CONNECTIONS,
  connectGrownGroupAndMask,
  innerConnections,
  rootConnections
} from '@e2e/fixtures/utils/autogrowConvertToSubgraph'
import { getInputNames } from '@e2e/fixtures/utils/nodeInputLinks'
import { routeObjectInfoFromSetupApi } from '@e2e/fixtures/utils/objectInfo'

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

    test('keeps every link on its input inside the subgraph', async ({
      comfyPage
    }) => {
      await comfyPage.nodeOps.selectNodes([AUTOGROW_THEN_MASK_NODE_TITLE])
      const subgraphNodeId =
        await comfyPage.subgraph.convertSelectionToSubgraph()

      const connections = await innerConnections(comfyPage, subgraphNodeId)

      expect(connections).toEqual(EXPECTED_CONNECTIONS)
    })
  }
)
