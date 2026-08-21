import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'

test.describe(
  'open color picker from node toolbox popover',
  { tag: [] },
  () => {
    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.canvasOps.resetView()
    })

    test('open color picker from node toolbox popover works as recorded', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('default')
      await comfyPage.nextFrame()
      await comfyPage.page
        .getByTestId('node-header-6')
        .getByText('CLIP Text Encode (Prompt)')
        .click()
      await comfyPage.page.getByTestId('color-picker-button').click()
      await expect(
        comfyPage.page.locator(
          '.absolute > .p-selectbutton > button:nth-child(2)'
        )
      ).toBeVisible()
    })
  }
)
