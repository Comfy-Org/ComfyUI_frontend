import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import {
  cleanupFakeModel,
  dismissErrorOverlay
} from '@e2e/fixtures/helpers/ErrorsTabHelper'

test.describe(
  'Missing model dialog recovery',
  { tag: ['@ui', '@workflow'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting(
        'Comfy.RightSidePanel.ShowErrorsTab',
        true
      )
      await cleanupFakeModel(comfyPage)
    })

    test('lists the filename, dismisses, and leaves the workflow editable and saveable', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('missing/missing_models')

      const overlay = comfyPage.page.getByTestId(TestIds.dialogs.errorOverlay)
      await expect(overlay).toBeVisible()
      await expect(overlay).toContainText('fake_model.safetensors')
      await dismissErrorOverlay(comfyPage)

      const node = await comfyPage.nodeOps.getNodeRefById('1')
      await node.dragBy({ x: 20, y: 20 })
      await expect.poll(() => node.exists()).toBe(true)

      await comfyPage.menu.topbar.saveWorkflow('missing-model-recovery')
    })
  }
)
