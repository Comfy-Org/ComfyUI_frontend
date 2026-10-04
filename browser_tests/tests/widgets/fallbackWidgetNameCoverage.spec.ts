import type { Page } from '@playwright/test'

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
 * Both workflows loaded here are pre-`widgets_values_named` KSamplers whose
 * seven saved values all differ from the node defaults, and in both the node
 * definition is served with a two-name fallback list. Every saved value must
 * survive — and the second case additionally pins *which* widget each value
 * lands on, which is the half a whole-node positional restore gets wrong.
 *
 * KSampler's serialized widget order is seed, control_after_generate, steps,
 * cfg, sampler_name, scheduler, denoise. Defaults are 0, randomize, 20, 8.0,
 * euler, normal, 1.00, so every assertion below is a real discriminator.
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

    async function routeFallbackNames(page: Page, names: string[]) {
      return routeObjectInfoFromSetupApi(page, (objectInfo) => {
        // Checked by key rather than by truthiness: `ObjectInfoResponse` is
        // an unchecked index signature, so a missing entry would otherwise
        // surface as an opaque route failure instead of naming the node.
        if (!Object.hasOwn(objectInfo, 'KSampler')) {
          throw new Error('Missing object_info entry for KSampler')
        }
        objectInfo['KSampler'].fallbackWidgetsValuesNames = names
      })
    }

    test('a fallback list that names only two of seven slots loses no saved value', async ({
      comfyPage
    }) => {
      // The legacy order matches the live order here, so only the unnamed tail
      // is at stake.
      const unrouteObjectInfo = await routeFallbackNames(comfyPage.page, [
        'seed',
        'control_after_generate'
      ])

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

    test('a fallback list that names two reordered slots places them by name, not by index', async ({
      comfyPage
    }) => {
      // This is the case the list exists for: the saved register was written
      // when control_after_generate came *before* seed. The two names repair
      // that; the five unnamed slots still line up by index.
      //
      // Restoring the whole node positionally instead — which is what refusing
      // to derive on incomplete coverage does — reads the string "fixed" into
      // seed and 987654321 into control_after_generate, so the Fixed Value
      // control disappears. Deriving a partial register without a per-slot
      // positional fill instead reverts steps, cfg, sampler_name, scheduler and
      // denoise to their defaults. Both failures are visible here.
      const unrouteObjectInfo = await routeFallbackNames(comfyPage.page, [
        'control_after_generate',
        'seed'
      ])

      try {
        await comfyPage.workflow.reloadAndWaitForApp()
        await comfyPage.workflow.loadWorkflow(
          'widgets/fallback-widget-name-reorder'
        )

        const node = comfyPage.vueNodes.getNodeLocator('1')

        // Placed by name, across the reorder.
        await expect(
          node.getByLabel('seed', { exact: true }).getByRole('spinbutton')
        ).toHaveValue('987654321')
        await expect(
          node.getByRole('button', { name: 'Fixed Value', exact: true })
        ).toBeVisible()

        // Placed by index, from the slots the list leaves free.
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
