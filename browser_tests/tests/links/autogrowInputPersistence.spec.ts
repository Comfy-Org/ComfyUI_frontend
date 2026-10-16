import {
  comfyExpect as expect,
  comfyPageFixture as baseTest
} from '@e2e/fixtures/ComfyPage'
import {
  AUTOGROW_REFERENCE_NODE_ID,
  AUTOGROW_REFERENCE_VIDEOS_WORKFLOW,
  AUTOGROW_REFERENCE_WORKFLOW,
  BYTEDANCE_REFERENCE_NODE_TYPE,
  REFERENCE_IMAGES_PREFIX,
  REFERENCE_VIDEOS_PREFIX,
  byteDanceReferenceNodeDef
} from '@e2e/fixtures/data/byteDanceReferenceNodeDef'
import { readAutogrowInputGroup } from '@e2e/fixtures/utils/nodeInputLinks'
import { routeObjectInfoFromSetupApi } from '@e2e/fixtures/utils/objectInfo'

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
    test.describe('image group grown by hand', () => {
      test.beforeEach(async ({ comfyPage }) => {
        await comfyPage.workflow.loadWorkflow(AUTOGROW_REFERENCE_WORKFLOW)
      })

      test('grown slots and their links survive a serialize round-trip', async ({
        comfyPage
      }) => {
        // Read the starting state instead of restating it. The workflow is shared
        // with the subgraph-unpack tests and has already gained a link once; a
        // spec that hard-codes its contents fails the next time that happens, and
        // the failure reads as a product regression rather than a stale
        // expectation.
        const before = await readAutogrowInputGroup(
          comfyPage,
          AUTOGROW_REFERENCE_NODE_ID,
          REFERENCE_IMAGES_PREFIX
        )

        // The invariant under test, stated as one: autogrow keeps exactly one
        // empty slot after the connected ones.
        expect(before.connections.length).toBeGreaterThan(0)
        expect(before.slotNames).toHaveLength(before.connections.length + 1)

        const loadImage = await comfyPage.nodeOps.getNodeRefById('18')
        const referenceNode = await comfyPage.nodeOps.getNodeRefById(
          AUTOGROW_REFERENCE_NODE_ID
        )
        await loadImage.connectOutput(
          0,
          referenceNode,
          before.trailingSlotIndex
        )

        const grownConnections = [
          ...before.connections,
          {
            name: before.slotNames[before.trailingSlotIndex],
            originNodeId: '18'
          }
        ]
        const grownSlotCount = before.slotNames.length + 1

        await expect
          .poll(async () => {
            const grown = await readAutogrowInputGroup(
              comfyPage,
              AUTOGROW_REFERENCE_NODE_ID,
              REFERENCE_IMAGES_PREFIX
            )
            return {
              connections: grown.connections,
              slotCount: grown.slotNames.length
            }
          })
          .toEqual({
            connections: grownConnections,
            slotCount: grownSlotCount
          })

        const serialized = await comfyPage.workflow.getExportedWorkflow()
        await comfyPage.workflow.loadGraphData(serialized)

        // The point of the test: the grown slot and its link are still there
        // after a round trip, and the group still ends in exactly one empty slot.
        const after = await readAutogrowInputGroup(
          comfyPage,
          AUTOGROW_REFERENCE_NODE_ID,
          REFERENCE_IMAGES_PREFIX
        )
        expect(after.connections).toEqual(grownConnections)
        expect(after.slotNames).toHaveLength(grownSlotCount)
        expect(after.slotNames.slice(0, before.slotNames.length)).toEqual(
          before.slotNames
        )
      })
    })

    test.describe('image and video groups wired in the saved workflow', () => {
      test.beforeEach(async ({ comfyPage }) => {
        await comfyPage.workflow.loadWorkflow(
          AUTOGROW_REFERENCE_VIDEOS_WORKFLOW
        )
      })

      test('every group stays wired after opening the saved workflow and switching tabs away and back', async ({
        comfyPage
      }) => {
        test.info().annotations.push({
          type: 'regression',
          description:
            'PR #20234 — reloading a DynamicCombo node with several autogrow groups re-targeted the image links and dropped the video links'
        })

        const wired = [
          {
            slotNames: [
              `${REFERENCE_IMAGES_PREFIX}image_1`,
              `${REFERENCE_IMAGES_PREFIX}image_2`,
              `${REFERENCE_IMAGES_PREFIX}image_3`,
              `${REFERENCE_IMAGES_PREFIX}image_4`
            ],
            connections: [
              { name: `${REFERENCE_IMAGES_PREFIX}image_1`, originNodeId: '18' },
              { name: `${REFERENCE_IMAGES_PREFIX}image_2`, originNodeId: '19' },
              { name: `${REFERENCE_IMAGES_PREFIX}image_3`, originNodeId: '20' }
            ],
            trailingSlotIndex: 3
          },
          {
            slotNames: [
              `${REFERENCE_VIDEOS_PREFIX}video_1`,
              `${REFERENCE_VIDEOS_PREFIX}video_2`,
              `${REFERENCE_VIDEOS_PREFIX}video_3`
            ],
            connections: [
              { name: `${REFERENCE_VIDEOS_PREFIX}video_1`, originNodeId: '21' },
              { name: `${REFERENCE_VIDEOS_PREFIX}video_2`, originNodeId: '22' }
            ],
            trailingSlotIndex: 2
          }
        ]

        await expect
          .poll(
            () =>
              Promise.all([
                readAutogrowInputGroup(
                  comfyPage,
                  AUTOGROW_REFERENCE_NODE_ID,
                  REFERENCE_IMAGES_PREFIX
                ),
                readAutogrowInputGroup(
                  comfyPage,
                  AUTOGROW_REFERENCE_NODE_ID,
                  REFERENCE_VIDEOS_PREFIX
                )
              ]),
            { message: 'Opening the saved workflow should wire every group' }
          )
          .toEqual(wired)

        await comfyPage.workflow.openNewTabThenReturn()

        await expect
          .poll(() =>
            Promise.all([
              readAutogrowInputGroup(
                comfyPage,
                AUTOGROW_REFERENCE_NODE_ID,
                REFERENCE_IMAGES_PREFIX
              ),
              readAutogrowInputGroup(
                comfyPage,
                AUTOGROW_REFERENCE_NODE_ID,
                REFERENCE_VIDEOS_PREFIX
              )
            ])
          )
          .toEqual(wired)
      })
    })
  }
)
