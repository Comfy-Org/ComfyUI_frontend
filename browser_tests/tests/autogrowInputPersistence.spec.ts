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

/**
 * An autogrow input group appends an empty slot as soon as its last one is
 * connected, so the slot count on disk is always one behind what the user sees.
 * Reloading has to rebuild the grown slots and reattach their links; a reload
 * that keeps the slots but drops the wires renders almost identically.
 */
test.describe('Autogrow input persistence', { tag: '@node' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('subgraphs/autogrow-reference-images')
  })

  test('grown slots and their links survive a serialize round-trip', async ({
    comfyPage
  }) => {
    const connected = () =>
      getConnectedInputs(comfyPage, REFERENCE_NODE_ID, REFERENCE_IMAGES_PREFIX)
    const slotNames = () =>
      getInputNames(comfyPage, REFERENCE_NODE_ID, REFERENCE_IMAGES_PREFIX)

    await expect.poll(connected).toEqual([
      { name: IMAGE_1, originNodeId: '18' },
      { name: IMAGE_2, originNodeId: '19' }
    ])
    await expect.poll(slotNames).toEqual([IMAGE_1, IMAGE_2, IMAGE_3])

    // Grow the group past what the fixture stores on disk. Without this the
    // round-trip could simply be re-reading the original file and still match.
    const loadImage = await comfyPage.nodeOps.getNodeRefById('18')
    const referenceNode =
      await comfyPage.nodeOps.getNodeRefById(REFERENCE_NODE_ID)
    await loadImage.connectOutput(0, referenceNode, 2)
    await expect.poll(slotNames).toEqual([IMAGE_1, IMAGE_2, IMAGE_3, IMAGE_4])

    const connectedBefore = await connected()
    expect(connectedBefore).toHaveLength(3)

    const serialized = await comfyPage.workflow.getExportedWorkflow()
    await comfyPage.workflow.loadGraphData(serialized)

    // Slot names alone cannot tell a rebuilt-but-unwired group from a restored
    // one, so the link origins are compared as well.
    await expect.poll(slotNames).toEqual([IMAGE_1, IMAGE_2, IMAGE_3, IMAGE_4])
    await expect.poll(connected).toEqual(connectedBefore)
  })
})
