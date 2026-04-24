import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

// Regression guard for the filter-chip surface affected by FE-226.
// The unit test at src/renderer/extensions/vueNodes/widgets/composables/
// useWidgetSelectItems.test.ts asserts the chronological sort order —
// this spec only ensures the "All / Inputs / Outputs" chips still render
// and the default filter is "All". A deeper e2e that drives cloud asset
// timestamps requires the @cloud build and is deferred.
test.describe(
  'FE-226 input-image dropdown filter chips',
  { tag: ['@vue-nodes', '@regression'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
      await comfyPage.workflow.loadWorkflow('nodes/load_image_with_ksampler')
      await comfyPage.vueNodes.waitForNodes()
    })

    test('renders All, Inputs, and Outputs chips with All selected by default', async ({
      comfyPage
    }) => {
      const loadImageNode = comfyPage.vueNodes.getNodeByTitle('Load Image')
      const imageWidget = loadImageNode
        .locator('.lg-node-widget')
        .filter({ has: comfyPage.page.getByLabel('image', { exact: true }) })
      await imageWidget.click()

      const allChip = comfyPage.page.getByRole('button', {
        name: 'All',
        exact: true
      })
      const inputsChip = comfyPage.page.getByRole('button', {
        name: 'Inputs',
        exact: true
      })
      const outputsChip = comfyPage.page.getByRole('button', {
        name: 'Outputs',
        exact: true
      })

      await expect(allChip).toBeVisible()
      await expect(inputsChip).toBeVisible()
      await expect(outputsChip).toBeVisible()

      await expect(allChip).toHaveClass(
        /bg-interface-menu-component-surface-selected/
      )
    })
  }
)
