import {
  comfyExpect as expect,
  comfyPageFixture as baseTest
} from '@e2e/fixtures/ComfyPage'
import {
  BYTEDANCE_REFERENCE_NODE_TYPE,
  REFERENCE_IMAGES_PREFIX,
  byteDanceReferenceNodeDef
} from '@e2e/fixtures/data/byteDanceReferenceNodeDef'
import {
  getConnectedInputs,
  getInputNames
} from '@e2e/fixtures/utils/nodeInputLinks'
import { routeObjectInfoFromSetupApi } from '@e2e/fixtures/utils/objectInfo'

const REFERENCE_NODE_ID = '26'
const IMAGE_1 = `${REFERENCE_IMAGES_PREFIX}image_1`
const IMAGE_2 = `${REFERENCE_IMAGES_PREFIX}image_2`
// Autogrow keeps one empty slot past the last connected one.
const REFERENCE_IMAGE_SLOTS = [
  IMAGE_1,
  IMAGE_2,
  `${REFERENCE_IMAGES_PREFIX}image_3`
]

const BLEND_NODE_ID = '3'
const BLEND_INPUT_PREFIX = 'image'

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
  'Convert to Subgraph boundary links',
  { tag: ['@subgraph', '@node'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.Canvas.SelectionToolbox', true)
    })

    test.describe('plain multi-input node', () => {
      test.beforeEach(async ({ comfyPage }) => {
        await comfyPage.workflow.loadWorkflow(
          'subgraphs/plain-multi-image-inputs'
        )
      })

      test('keeps every link when its sources become a subgraph', async ({
        comfyPage
      }) => {
        await comfyPage.nodeOps.selectNodes(['Load Image'])
        const subgraphNodeId =
          await comfyPage.subgraph.convertSelectionToSubgraph()

        await expect
          .poll(() =>
            getConnectedInputs(comfyPage, BLEND_NODE_ID, BLEND_INPUT_PREFIX)
          )
          .toEqual([
            { name: 'image1', originNodeId: subgraphNodeId },
            { name: 'image2', originNodeId: subgraphNodeId }
          ])
      })
    })

    test.describe('autogrow input group', () => {
      test.beforeEach(async ({ comfyPage }) => {
        await comfyPage.workflow.loadWorkflow(
          'subgraphs/autogrow-reference-images'
        )
      })

      test('loads with both reference images connected', async ({
        comfyPage
      }) => {
        await expect
          .poll(() =>
            getConnectedInputs(
              comfyPage,
              REFERENCE_NODE_ID,
              REFERENCE_IMAGES_PREFIX
            )
          )
          .toEqual([
            { name: IMAGE_1, originNodeId: '18' },
            { name: IMAGE_2, originNodeId: '19' }
          ])

        await expect
          .poll(() =>
            getInputNames(comfyPage, REFERENCE_NODE_ID, REFERENCE_IMAGES_PREFIX)
          )
          .toEqual(REFERENCE_IMAGE_SLOTS)
      })

      // Reported in #bug-dump: converting the upstream Load Image nodes into a
      // subgraph leaves only the first reference-image connection attached to
      // the downstream node; the rest are silently dropped. The plain
      // multi-input node above keeps all of its links through the same
      // conversion, so the loss is specific to autogrow groups.
      test('keeps every link when its sources become a subgraph', async ({
        comfyPage
      }) => {
        await comfyPage.nodeOps.selectNodes(['Load Image'])
        expect(await comfyPage.nodeOps.getSelectedNodeIds()).toEqual([
          '18',
          '19'
        ])
        const subgraphNodeId =
          await comfyPage.subgraph.convertSelectionToSubgraph()

        test.fail()
        await expect
          .poll(() =>
            getConnectedInputs(
              comfyPage,
              REFERENCE_NODE_ID,
              REFERENCE_IMAGES_PREFIX
            )
          )
          .toEqual([
            { name: IMAGE_1, originNodeId: subgraphNodeId },
            { name: IMAGE_2, originNodeId: subgraphNodeId }
          ])

        await expect
          .poll(() =>
            getInputNames(comfyPage, REFERENCE_NODE_ID, REFERENCE_IMAGES_PREFIX)
          )
          .toEqual(REFERENCE_IMAGE_SLOTS)
      })
    })
  }
)
