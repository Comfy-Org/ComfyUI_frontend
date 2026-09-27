import {
  comfyExpect as expect,
  comfyPageFixture
} from '@e2e/fixtures/ComfyPage'
import {
  routeObjectInfoFromSetupApi,
  setComboInputOptions
} from '@e2e/fixtures/utils/objectInfo'

const test = comfyPageFixture.extend({
  page: async ({ page }, use) => {
    const unrouteObjectInfo = await routeObjectInfoFromSetupApi(
      page,
      (objectInfo) =>
        setComboInputOptions(
          objectInfo,
          'CheckpointLoaderSimple',
          'ckpt_name',
          []
        )
    )

    try {
      await use(page)
    } finally {
      await unrouteObjectInfo()
    }
  }
})

test.describe(
  'Vue combo widget null values',
  { tag: ['@vue-nodes', '@widget'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('vueNodes/null-combo-value')
    })

    test('loading a workflow with an unset combo value does not display "null"', async ({
      comfyPage
    }) => {
      const checkpointCombo = comfyPage.vueNodes
        .getNodeByTitle('Load Checkpoint')
        .getByRole('combobox', { name: 'ckpt_name', exact: true })

      await expect(checkpointCombo).toHaveText('')
    })
  }
)
