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
    test.describe.configure({ timeout: 45_000 })

    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting(
        'Comfy.RightSidePanel.ShowErrorsTab',
        true
      )
      await cleanupFakeModel(comfyPage)
    })

    test('lists the filename, dismisses, and persists a drag in both renderers', async ({
      comfyPage
    }) => {
      test.slow()
      await comfyPage.page.route(
        'http://localhost:8188/api/devtools/**',
        async (route) => await route.fulfill({ status: 404 })
      )
      for (const vueNodesEnabled of [false, true]) {
        await comfyPage.settings.setSetting(
          'Comfy.VueNodes.Enabled',
          vueNodesEnabled
        )
        await comfyPage.workflow.loadWorkflow('missing/missing_models')

        const overlay = comfyPage.page.getByTestId(TestIds.dialogs.errorOverlay)
        await expect(overlay).toBeVisible()
        await expect(overlay).toContainText('fake_model.safetensors')
        await dismissErrorOverlay(comfyPage)

        const node = await comfyPage.nodeOps.getNodeRefById('1')
        const oldPosition = await node.getPosition()
        await node.dragBy({ x: 20, y: 20 })
        const draggedPosition = await node.getPosition()
        expect(draggedPosition).not.toEqual(oldPosition)

        await comfyPage.menu.topbar.saveWorkflow(
          `missing-model-recovery-${vueNodesEnabled ? 'vue' : 'legacy'}`
        )
        await comfyPage.workflow.reloadAndWaitForApp()
        const reloadedNode = await comfyPage.nodeOps.getNodeRefById('1')
        await expect
          .poll(() => reloadedNode.getPosition())
          .toEqual(draggedPosition)
      }
    })
  }
)
