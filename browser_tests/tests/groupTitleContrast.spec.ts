import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { setGroupColor } from '@e2e/fixtures/utils/groupHelpers'

const GROUP_TITLE = 'Group'
const POOR_CONTRAST_COLOR = 'black'

test.describe(
  'Group Title Contrast',
  { tag: ['@screenshot', '@canvas'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('groups/single_group_only')
    })

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.canvasOps.resetView()
    })

    test('renders readable title text when a group color is set to black', async ({
      comfyPage
    }) => {
      await setGroupColor(comfyPage, GROUP_TITLE, POOR_CONTRAST_COLOR)

      await expect(comfyPage.canvas).toHaveScreenshot(
        'group-title-contrast-black.png'
      )
    })
  }
)
