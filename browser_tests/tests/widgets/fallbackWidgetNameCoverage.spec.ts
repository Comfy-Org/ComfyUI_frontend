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
 * derived register no live widget can read does not leave the node alone — it
 * switches the node into named mode and resets every widget to its default.
 *
 * Both workflows here are pre-`widgets_values_named` KSamplers whose seven saved
 * values all differ from the node defaults. KSampler's serialized widget order
 * is seed, control_after_generate, steps, cfg, sampler_name, scheduler, denoise,
 * and its defaults are 0, randomize, 20, 8.0, euler, normal, 1.00 — so every
 * assertion below is a real discriminator.
 *
 * The two cases pin opposite halves of one contract, and each fails for a
 * different reason under a different plausible implementation:
 *
 * - an empty list must not discard the register (it does on the unmodified
 *   code), and
 * - a list that names reordered slots must still place them **by name** (a
 *   whole-node positional restore swaps them).
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

    test('an empty fallback list loses no saved value', async ({
      comfyPage
    }) => {
      // The list names nothing, so it declares no legacy order and the saved
      // register is read positionally, exactly as before the node opted in.
      // Deriving an empty register instead switches the node into named mode
      // and all seven widgets fall to their defaults.
      const unrouteObjectInfo = await routeFallbackNames(comfyPage.page, [])

      try {
        await comfyPage.workflow.reloadAndWaitForApp()
        await comfyPage.workflow.loadWorkflow(
          'widgets/fallback-widget-name-coverage'
        )

        const node = comfyPage.vueNodes.getNodeLocator('1')

        await expect(
          node.getByLabel('seed', { exact: true }).getByRole('spinbutton')
        ).toHaveValue('987654321')
        await expect(
          node.getByRole('button', { name: 'Fixed Value', exact: true })
        ).toBeVisible()
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
      // when control_after_generate came *before* seed. Restoring the whole
      // node positionally instead — which is what refusing to derive on
      // incomplete coverage does — reads the string "fixed" into seed and
      // 987654321 into control_after_generate, so the Fixed Value control
      // disappears.
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

        await expect(
          node.getByLabel('seed', { exact: true }).getByRole('spinbutton')
        ).toHaveValue('987654321')
        await expect(
          node.getByRole('button', { name: 'Fixed Value', exact: true })
        ).toBeVisible()

        // The five slots the list does not name are deliberately left on node
        // defaults rather than guessed at — the list's own premise is that the
        // current index is not known to be the legacy index. Asserted, not
        // merely accepted, so that a later change cannot quietly fill them
        // from the wrong coordinate system without turning this red.
        await expect(
          node.getByLabel('steps', { exact: true }).getByRole('spinbutton')
        ).toHaveValue('20')
        await expect(
          node.getByRole('combobox', { name: 'sampler_name', exact: true })
        ).toContainText('euler')
      } finally {
        await unrouteObjectInfo()
      }
    })
  }
)
