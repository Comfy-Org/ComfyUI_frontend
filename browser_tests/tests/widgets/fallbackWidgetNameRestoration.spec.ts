import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import {
  getNodeInfo,
  routeObjectInfoFromSetupApi
} from '@e2e/fixtures/utils/objectInfo'

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

    test('an empty fallback list activates the existing named register', async ({
      comfyPage
    }) => {
      const unrouteObjectInfo = await routeObjectInfoFromSetupApi(
        comfyPage.page,
        (objectInfo) => {
          const kSampler = getNodeInfo(objectInfo, 'KSampler')
          kSampler.fallbackWidgetsValuesNames = []
        }
      )

      try {
        await comfyPage.workflow.reloadAndWaitForApp()
        await comfyPage.workflow.loadWorkflow(
          'widgets/fallback-widget-name-restoration'
        )

        const node = comfyPage.vueNodes.getNodeLocator('1')
        await expect(
          node.getByLabel('seed', { exact: true }).getByRole('spinbutton')
        ).toHaveValue('987654321')
        await expect(
          node.getByLabel('steps', { exact: true }).getByRole('spinbutton')
        ).toHaveValue('37')
        await expect(
          node.getByLabel('cfg', { exact: true }).getByRole('spinbutton')
        ).toHaveValue('6.0')
        await expect(
          node.getByLabel('denoise', { exact: true }).getByRole('spinbutton')
        ).toHaveValue('0.75')
        await expect(
          node.getByRole('button', { name: 'Fixed Value', exact: true })
        ).toBeVisible()
        await expect(
          node.getByRole('combobox', { name: 'sampler_name', exact: true })
        ).toContainText('heun')
        await expect(
          node.getByRole('combobox', { name: 'scheduler', exact: true })
        ).toContainText('karras')
      } finally {
        await unrouteObjectInfo()
      }
    })
  }
)
