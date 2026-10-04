import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { routeObjectInfoFromSetupApi } from '@e2e/fixtures/utils/objectInfo'

/**
 * A node opts into named widget restoration by shipping
 * `fallbackWidgetsValuesNames`, which names each slot of the legacy
 * `widgets_values` order. Named restoration does not fall back per widget, so a
 * list that names only part of the register used to reset every unnamed widget
 * to its node default while the saved workflow still held a value for it.
 *
 * The workflow loaded here is a pre-`widgets_values_named` KSampler whose seven
 * saved values all differ from the node defaults, and the node definition is
 * served with a two-name fallback list. Every saved value must survive.
 */
test.describe(
  'partial backend fallback widget-name coverage',
  { tag: ['@canvas', '@widget', '@vue-nodes'] },
  () => {
    test.use({
      initialSettings: {
        'Comfy.VueNodes.Enabled': true,
        'Comfy.Workflow.NamedValuesRestore': false
      }
    })

    test('a fallback list that names only two of seven slots loses no saved value', async ({
      comfyPage
    }) => {
      const unrouteObjectInfo = await routeObjectInfoFromSetupApi(
        comfyPage.page,
        (objectInfo) => {
          // Checked by key rather than by truthiness: `ObjectInfoResponse` is
          // an unchecked index signature, so a missing entry would otherwise
          // surface as an opaque route failure instead of naming the node.
          if (!Object.hasOwn(objectInfo, 'KSampler')) {
            throw new Error('Missing object_info entry for KSampler')
          }
          objectInfo['KSampler'].fallbackWidgetsValuesNames = [
            'seed',
            'control_after_generate'
          ]
        }
      )

      try {
        await comfyPage.workflow.reloadAndWaitForApp()
        await comfyPage.workflow.loadWorkflow(
          'widgets/fallback-widget-name-coverage'
        )

        const node = comfyPage.vueNodes.getNodeLocator('1')

        // Named by the fallback list.
        await expect(
          node.getByLabel('seed', { exact: true }).getByRole('spinbutton')
        ).toHaveValue('987654321')
        await expect(
          node.getByRole('button', { name: 'Fixed Value', exact: true })
        ).toBeVisible()

        // Unnamed by it, and therefore the slots that used to be discarded.
        await expect(
          node.getByLabel('steps', { exact: true }).getByRole('spinbutton')
        ).toHaveValue('37')
        await expect(
          node.getByLabel('cfg', { exact: true }).getByRole('spinbutton')
        ).toHaveValue('6.0')
        await expect(
          node.getByRole('combobox', { name: 'sampler_name', exact: true })
        ).toContainText('heun')
        await expect(
          node.getByRole('combobox', { name: 'scheduler', exact: true })
        ).toContainText('karras')
        await expect(
          node.getByLabel('denoise', { exact: true }).getByRole('spinbutton')
        ).toHaveValue('0.75')
      } finally {
        await unrouteObjectInfo()
      }
    })
  }
)
