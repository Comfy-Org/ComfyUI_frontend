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
const IMAGE_SOURCE_NODE_ID = '2'
const IMAGES_PREFIX = 'model.images.'
const WORKFLOW_NODE_COUNT = 2
const SAVED_WORKFLOW_NAME = 'autogrow-images'

const CONNECTED_IMAGE_NAMES = [1, 2, 3, 4, 5].map(
  (ordinal) => `${IMAGES_PREFIX}image_${ordinal}`
)
const CONNECTED_IMAGES = CONNECTED_IMAGE_NAMES.map((name) => ({
  name,
  originNodeId: IMAGE_SOURCE_NODE_ID
}))
// Autogrow keeps one empty slot past the last connected one.
const IMAGE_SLOTS = [...CONNECTED_IMAGE_NAMES, `${IMAGES_PREFIX}image_6`]

test.describe(
  'Dynamic combo autogrow links across a workflow tab switch',
  { tag: ['@canvas', '@node', '@workflow'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      test.setTimeout(60_000)
      await comfyPage.workflow.setupWorkflowsDirectory({})
      await comfyPage.workflow.loadWorkflow(
        'links/dynamic_combo_autogrow_images'
      )

      const source =
        await comfyPage.nodeOps.getNodeRefById(IMAGE_SOURCE_NODE_ID)
      const autogrowNode =
        await comfyPage.nodeOps.getNodeRefById(AUTOGROW_NODE_ID)
      for (const name of CONNECTED_IMAGE_NAMES) {
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
