import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
import { openWorkflowFromSidebar } from '@e2e/fixtures/utils/builderTestUtils'

const PROMPT_INPUT: [string, string] = ['6', 'text']
const PROMPT_KEY = PROMPT_INPUT.join(':')

test.describe('App mode widget resize', { tag: ['@ui', '@widget'] }, () => {
  test('Resized textarea height is saved with the workflow', async ({
    comfyPage
  }) => {
    const { appMode } = comfyPage
    await appMode.enterAppModeWithInputs([PROMPT_INPUT])
    const textarea = appMode.widgets
      .getWidgetItem(PROMPT_KEY)
      .locator('textarea')
    await expect(textarea).toBeVisible()

    const startHeight = (await textarea.boundingBox())!.height
    let resizedHeight = 0

    await test.step('Dragging the grip grows the textarea', async () => {
      await appMode.widgets.resizeTextareaBy(PROMPT_KEY, 80)
      resizedHeight = (await textarea.boundingBox())!.height
      expect(resizedHeight).toBeGreaterThan(startHeight + 60)
      await expect
        .poll(() => comfyPage.workflow.isCurrentWorkflowModified())
        .toBe(true)
    })

    await test.step('Reopened workflow restores the height', async () => {
      const workflowName = `${Date.now()} app-mode-textarea-resize`
      await appMode.toggleAppMode()
      await comfyPage.menu.topbar.saveWorkflow(workflowName)
      await openWorkflowFromSidebar(comfyPage, workflowName)
      await appMode.toggleAppMode()

      await expect(textarea).toBeVisible()
      await expect
        .poll(async () => (await textarea.boundingBox())?.height)
        .toBe(resizedHeight)
    })
  })
})
