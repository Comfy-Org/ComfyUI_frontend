import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import {
  getConnectedInputs,
  getInputNames,
  getInputSlotIndex
} from '@e2e/fixtures/utils/nodeInputLinks'

const AUTOGROW_NODE_ID = '1'
const IMAGES_PREFIX = 'model.images.'
const WORKFLOW_NAME = 'dynamic_combo_autogrow_images'

// One image source per slot, so a rebuild that restores the links but pairs
// them with the wrong ordinals is still a failure.
const CONNECTED_IMAGES = [
  { name: `${IMAGES_PREFIX}image_1`, originNodeId: '2' },
  { name: `${IMAGES_PREFIX}image_2`, originNodeId: '3' },
  { name: `${IMAGES_PREFIX}image_3`, originNodeId: '4' },
  { name: `${IMAGES_PREFIX}image_4`, originNodeId: '5' },
  { name: `${IMAGES_PREFIX}image_5`, originNodeId: '6' }
]
// Autogrow keeps one empty slot past the last connected one.
const IMAGE_SLOTS = [
  ...CONNECTED_IMAGES.map(({ name }) => name),
  `${IMAGES_PREFIX}image_6`
]
const WORKFLOW_NODE_COUNT = CONNECTED_IMAGES.length + 1

test.describe(
  'Dynamic combo autogrow links across a workflow tab switch',
  { tag: ['@canvas', '@node', '@workflow', '@slow'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      // Required, not slack: five interactive drags plus a poll the pinned
      // test never satisfies run ~15.6s, against the chromium project's 15s.
      // Without this the pin times out and reports red instead of expected.
      test.slow()
      await comfyPage.workflow.loadWorkflow(`links/${WORKFLOW_NAME}`)

      const autogrowNode =
        await comfyPage.nodeOps.getNodeRefById(AUTOGROW_NODE_ID)
      for (const { name, originNodeId } of CONNECTED_IMAGES) {
        const source = await comfyPage.nodeOps.getNodeRefById(originNodeId)
        const slot = await getInputSlotIndex(comfyPage, AUTOGROW_NODE_ID, name)
        await source.connectOutput(0, autogrowNode, slot)
      }
    })

    test('grows a slot per connected image', async ({ comfyPage }) => {
      await expect
        .poll(() => getInputNames(comfyPage, AUTOGROW_NODE_ID, IMAGES_PREFIX))
        .toEqual(IMAGE_SLOTS)
      await expect
        .poll(() =>
          getConnectedInputs(comfyPage, AUTOGROW_NODE_ID, IMAGES_PREFIX)
        )
        .toEqual(CONNECTED_IMAGES)
    })

    test('keeps every image link when the tab is revisited', async ({
      comfyPage
    }) => {
      // test.fail() below reports a broken setup as success, so prove the
      // links are all there before the part under test runs.
      await expect
        .poll(() =>
          getConnectedInputs(comfyPage, AUTOGROW_NODE_ID, IMAGES_PREFIX)
        )
        .toEqual(CONNECTED_IMAGES)

      await comfyPage.menu.topbar.newWorkflowButton.click()
      await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(0)

      await comfyPage.workflow.switchToTab(WORKFLOW_NAME)
      await expect
        .poll(() => comfyPage.nodeOps.getGraphNodesCount())
        .toBe(WORKFLOW_NODE_COUNT)

      // FE-2443: switching tabs reloads the workflow, and applying the dynamic
      // combo's serialized value rebuilds its child inputs — regenerating only
      // `min + 1` autogrow slots. Every link past that is handed to an input
      // the rebuilt group no longer defines and is disconnected outright, so
      // the graph comes back with no image links at all.
      // Pinned with test.fail() so the fix flips this to passing.
      test.fail()
      await expect
        .poll(() =>
          getConnectedInputs(comfyPage, AUTOGROW_NODE_ID, IMAGES_PREFIX)
        )
        .toEqual(CONNECTED_IMAGES)
    })
  }
)
