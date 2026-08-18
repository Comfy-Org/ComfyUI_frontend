import {
  comfyExpect as expect,
  comfyPageFixture as baseTest
} from '@e2e/fixtures/ComfyPage'
import {
  BYTEDANCE_REFERENCE_NODE_TYPE,
  REFERENCE_IMAGES_GROUP,
  byteDanceReferenceNodeDef
} from '@e2e/fixtures/data/byteDanceReferenceNodeDef'
import { TestIds } from '@e2e/fixtures/selectors'
import { getConnectedGroupInputs } from '@e2e/fixtures/utils/nodeInputLinks'
import { routeObjectInfoFromSetupApi } from '@e2e/fixtures/utils/objectInfo'

const REFERENCE_NODE_ID = '26'
const IMAGE_1 = `${REFERENCE_IMAGES_GROUP}.image_1`
const IMAGE_2 = `${REFERENCE_IMAGES_GROUP}.image_2`

const test = baseTest.extend({
  page: async ({ page }, use) => {
    const unrouteObjectInfo = await routeObjectInfoFromSetupApi(
      page,
      (objectInfo) => {
        objectInfo[BYTEDANCE_REFERENCE_NODE_TYPE] = byteDanceReferenceNodeDef
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
  'Convert to Subgraph with autogrow inputs',
  { tag: ['@subgraph', '@node'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.Canvas.SelectionToolbox', true)
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/autogrow-reference-images'
      )
    })

    // Reported in #bug-dump: converting the upstream Load Image nodes into a
    // subgraph leaves only the first reference-image connection attached to the
    // downstream node; the rest are silently dropped. Those reference slots are
    // a COMFY_AUTOGROW_V3 group, and a plain (non-autogrow) multi-input node
    // keeps all of its boundary links through the same conversion.
    // Marked `fail` until the conversion stops dropping them.
    test.fail(
      'keeps every boundary link into an autogrow input group',
      async ({ comfyPage }) => {
        await expect
          .poll(
            () =>
              getConnectedGroupInputs(
                comfyPage,
                REFERENCE_NODE_ID,
                REFERENCE_IMAGES_GROUP
              ),
            'Both Load Image nodes feed the reference group before converting'
          )
          .toEqual([
            { name: IMAGE_1, originNodeId: '18' },
            { name: IMAGE_2, originNodeId: '19' }
          ])

        await comfyPage.nodeOps.selectNodes(['Load Image'])
        await comfyPage.page
          .getByTestId(TestIds.selectionToolbox.convertSubgraph)
          .click()

        await expect
          .poll(() => comfyPage.nodeOps.getNodeRefsByTitle('New Subgraph'))
          .toHaveLength(1)
        const [subgraphNode] =
          await comfyPage.nodeOps.getNodeRefsByTitle('New Subgraph')
        const subgraphNodeId = String(subgraphNode.id)

        await expect
          .poll(() =>
            getConnectedGroupInputs(
              comfyPage,
              REFERENCE_NODE_ID,
              REFERENCE_IMAGES_GROUP
            )
          )
          .toEqual([
            { name: IMAGE_1, originNodeId: subgraphNodeId },
            { name: IMAGE_2, originNodeId: subgraphNodeId }
          ])
      }
    )
  }
)
