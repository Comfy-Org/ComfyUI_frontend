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
const IMAGE_3 = `${REFERENCE_IMAGES_PREFIX}image_3`
const IMAGE_4 = `${REFERENCE_IMAGES_PREFIX}image_4`

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
  'Autogrow input persistence',
  { tag: ['@canvas', '@node'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/autogrow-reference-images'
      )
    })

    test('grown slots and their links survive a serialize round-trip', async ({
      comfyPage
    }) => {
      const connected = () =>
        getConnectedInputs(
          comfyPage,
          REFERENCE_NODE_ID,
          REFERENCE_IMAGES_PREFIX
        )
      const slotNames = () =>
        getInputNames(comfyPage, REFERENCE_NODE_ID, REFERENCE_IMAGES_PREFIX)

      const initialConnections = [
        { name: IMAGE_1, originNodeId: '18' },
        { name: IMAGE_2, originNodeId: '19' }
      ]
      const grownConnections = [
        ...initialConnections,
        { name: IMAGE_3, originNodeId: '18' }
      ]

      await expect.poll(connected).toEqual(initialConnections)
      await expect.poll(slotNames).toEqual([IMAGE_1, IMAGE_2, IMAGE_3])

      const loadImage = await comfyPage.nodeOps.getNodeRefById('18')
      const referenceNode =
        await comfyPage.nodeOps.getNodeRefById(REFERENCE_NODE_ID)
      await loadImage.connectOutput(0, referenceNode, 2)
      await expect.poll(slotNames).toEqual([IMAGE_1, IMAGE_2, IMAGE_3, IMAGE_4])
      await expect.poll(connected).toEqual(grownConnections)

      const serialized = await comfyPage.workflow.getExportedWorkflow()
      await comfyPage.workflow.loadGraphData(serialized)

      await expect.poll(slotNames).toEqual([IMAGE_1, IMAGE_2, IMAGE_3, IMAGE_4])
      await expect.poll(connected).toEqual(grownConnections)
    })
  }
)
