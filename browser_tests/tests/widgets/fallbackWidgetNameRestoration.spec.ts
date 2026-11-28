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
        await comfyPage.workflow.loadWorkflow('nodes/single_ksampler', {
          nodes: {
            3: {
              widgets_values_named: {
                seed: 987654321,
                control_after_generate: 'fixed',
                steps: 37,
                cfg: 6,
                sampler_name: 'heun',
                scheduler: 'karras',
                denoise: 0.75
              }
            }
          }
        })

        const node = comfyPage.vueNodes.getNodeLocator('3')
        await expect(
          node.getByRole('spinbutton', { name: 'seed', exact: true })
        ).toHaveValue('987654321')
        await expect(
          node.getByRole('spinbutton', { name: 'steps', exact: true })
        ).toHaveValue('37')
        await expect(
          node.getByRole('spinbutton', { name: 'cfg', exact: true })
        ).toHaveValue('6.0')
        await expect(
          node.getByRole('spinbutton', { name: 'denoise', exact: true })
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

    test('an empty fallback list preserves legacy positional values', async ({
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
        await comfyPage.workflow.loadWorkflow('nodes/single_ksampler', {
          nodes: {
            3: {
              widgets_values: [
                987654321,
                'fixed',
                37,
                6,
                'heun',
                'karras',
                0.75
              ]
            }
          }
        })

        const node = comfyPage.vueNodes.getNodeLocator('3')
        await expect(
          node.getByRole('spinbutton', { name: 'seed', exact: true })
        ).toHaveValue('987654321')
        await expect(
          node.getByRole('spinbutton', { name: 'steps', exact: true })
        ).toHaveValue('37')
        await expect(
          node.getByRole('spinbutton', { name: 'cfg', exact: true })
        ).toHaveValue('6.0')
        await expect(
          node.getByRole('spinbutton', { name: 'denoise', exact: true })
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
