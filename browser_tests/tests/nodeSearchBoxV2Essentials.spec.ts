import { createMockNodeDefinitions } from '@e2e/fixtures/data/nodeDefinitions'
import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

const CORE_ESSENTIAL = 'FE568CoreEssential'
const CUSTOM_PACK_ESSENTIAL = 'FE568CustomPackEssential'

const fixtureDefs = createMockNodeDefinitions({
  [CORE_ESSENTIAL]: {
    input: { required: {}, optional: {} },
    output: ['IMAGE'],
    output_name: ['image'],
    output_is_list: [false],
    output_node: false,
    name: CORE_ESSENTIAL,
    display_name: 'FE568 Core Essential',
    description: 'Core essential — FE-568 regression fixture',
    category: 'image/upscaling',
    python_module: 'comfy_extras.nodes_images',
    essentials_category: 'image tools'
  },
  [CUSTOM_PACK_ESSENTIAL]: {
    input: { required: {}, optional: {} },
    output: ['IMAGE'],
    output_name: ['image'],
    output_is_list: [false],
    output_node: false,
    name: CUSTOM_PACK_ESSENTIAL,
    display_name: 'FE568 Custom Pack Essential',
    description: 'Custom-pack essential — FE-568 regression fixture',
    category: 'KJNodes/masking',
    python_module: 'custom_nodes.comfyui-kjnodes',
    essentials_category: 'image tools'
  }
})

test.describe(
  'Node search box V2 — Essentials/Extensions classification (FE-568)',
  { tag: '@node' },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.page.route('**/api/object_info', (route) =>
        route.fulfill({ json: fixtureDefs })
      )
      await comfyPage.workflow.reloadAndWaitForApp()
      await comfyPage.searchBoxV2.setup()
    })

    test('Essentials chip excludes custom-pack nodes that declare essentials_category', async ({
      comfyPage
    }) => {
      const { searchBoxV2 } = comfyPage
      await searchBoxV2.open()
      await searchBoxV2.rootCategoryButton('essentials').click()
      await searchBoxV2.input.fill('FE568')

      await expect(
        searchBoxV2.results.filter({ hasText: 'FE568 Core Essential' })
      ).toHaveCount(1)
      await expect(
        searchBoxV2.results.filter({ hasText: 'FE568 Custom Pack Essential' })
      ).toHaveCount(0)
    })

    test('Extensions chip includes custom-pack nodes that declare essentials_category', async ({
      comfyPage
    }) => {
      const { searchBoxV2 } = comfyPage
      await searchBoxV2.open()
      await searchBoxV2.rootCategoryButton('custom').click()
      await searchBoxV2.input.fill('FE568')

      await expect(
        searchBoxV2.results.filter({ hasText: 'FE568 Custom Pack Essential' })
      ).toHaveCount(1)
      await expect(
        searchBoxV2.results.filter({ hasText: 'FE568 Core Essential' })
      ).toHaveCount(0)
    })
  }
)
