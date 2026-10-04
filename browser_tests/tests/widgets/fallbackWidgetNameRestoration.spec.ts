import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { routeObjectInfoFromSetupApi } from '@e2e/fixtures/utils/objectInfo'

test.describe(
  'backend fallback widget-name restoration',
  { tag: ['@canvas', '@widget', '@vue-nodes'] },
  () => {
    test.use({
      initialSettings: {
        'Comfy.VueNodes.Enabled': true,
        'Comfy.Workflow.NamedValuesRestore': false
      }
    })

    test('an empty fallback name list restores visible values by name', async ({
      comfyPage
    }) => {
      const unrouteObjectInfo = await routeObjectInfoFromSetupApi(
        comfyPage.page,
        (objectInfo) => {
          objectInfo.KSampler.fallbackWidgetsValuesNames = []
        }
      )

      try {
        await comfyPage.workflow.reloadAndWaitForApp()
        await comfyPage.workflow.loadWorkflow(
          'widgets/fallback-widget-name-restoration'
        )

        const node = comfyPage.vueNodes.getNodeLocator('1')
        await expect(node.getByText('seed', { exact: true })).toBeVisible()
        await expect(node.getByRole('spinbutton').nth(0)).toHaveValue(
          '987654321'
        )
        await expect(node.getByText('steps', { exact: true })).toBeVisible()
        await expect(node.getByRole('spinbutton').nth(1)).toHaveValue('37')
      } finally {
        await unrouteObjectInfo()
      }
    })
  }
)
