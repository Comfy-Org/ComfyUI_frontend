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
const SAVED_WORKFLOW_NAME = 'autogrow-images'

// One image source per slot, so a rebuild that restores the links but pairs
// them with the wrong ordinals is still a failure.
const IMAGE_SOURCE_NODE_IDS = ['2', '3', '4', '5', '6']
const CONNECTED_IMAGES = IMAGE_SOURCE_NODE_IDS.map((originNodeId, index) => ({
  name: `${IMAGES_PREFIX}image_${index + 1}`,
  originNodeId
}))
const WORKFLOW_NODE_COUNT = IMAGE_SOURCE_NODE_IDS.length + 1
// Autogrow keeps one empty slot past the last connected one.
const IMAGE_SLOTS = [
  ...CONNECTED_IMAGES.map(({ name }) => name),
  `${IMAGES_PREFIX}image_${IMAGE_SOURCE_NODE_IDS.length + 1}`
]

test.describe(
  'Dynamic combo autogrow links across a workflow tab switch',
  { tag: ['@canvas', '@node', '@workflow'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      test.slow()
      await comfyPage.workflow.setupWorkflowsDirectory({})
      await comfyPage.workflow.loadWorkflow(
        'links/dynamic_combo_autogrow_images'
      )

      const autogrowNode =
        await comfyPage.nodeOps.getNodeRefById(AUTOGROW_NODE_ID)
      for (const { name, originNodeId } of CONNECTED_IMAGES) {
        const source = await comfyPage.nodeOps.getNodeRefById(originNodeId)
        const slot = await getInputSlotIndex(comfyPage, AUTOGROW_NODE_ID, name)
        await source.connectOutput(0, autogrowNode, slot)
      }
    })

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.workflow.setupWorkflowsDirectory({})
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

      // Saving names this tab so the tab locator matches it alone; the blank
      // tab opened next would otherwise share the "Unnamed Workflow" label.
      await comfyPage.menu.topbar.saveWorkflow(SAVED_WORKFLOW_NAME)

      await comfyPage.menu.topbar.triggerTopbarCommand(['New'])
      await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(0)

      await comfyPage.workflow.switchToTab(SAVED_WORKFLOW_NAME)
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
