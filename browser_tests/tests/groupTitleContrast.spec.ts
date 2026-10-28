import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { setGroupColor } from '@e2e/fixtures/utils/groupHelpers'
import {
  expectRegionScreenshot,
  graphItems
} from '@e2e/fixtures/utils/screenshotRegion'

const GROUP_TITLE = 'Group'
const POOR_CONTRAST_COLOR = 'black'

test.describe(
  'Group Title Contrast',
  { tag: ['@screenshot', '@canvas'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('groups/single_group_only')
    })

    test('renders readable title text when a group color is set to black', async ({
      comfyPage
    }) => {
      await setGroupColor(comfyPage, GROUP_TITLE, POOR_CONTRAST_COLOR)

      await expectRegionScreenshot(
        comfyPage.page,
        [graphItems(comfyPage.page, 'groups')],
        'group-title-contrast-black.png'
      )
    })
  }
)
