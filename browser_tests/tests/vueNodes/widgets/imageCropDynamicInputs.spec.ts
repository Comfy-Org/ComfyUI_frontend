import {
  comfyExpect as expect,
  comfyPageFixture
} from '@e2e/fixtures/ComfyPage'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'

const test = comfyPageFixture.extend({
  page: async ({ page }, use) => {
    await page.route('**/object_info', async (route) => {
      const response = await route.fetch()
      const definitions: Record<string, ComfyNodeDef> = await response.json()
      const cropNode: ComfyNodeDef = {
        name: 'DynamicInputImageCrop',
        display_name: 'Dynamic Input Image Crop',
        category: 'testing',
        python_module: 'nodes',
        description: '',
        input: {
          required: {
            model: [
              'COMFY_DYNAMICCOMBO_V3',
              {
                options: [
                  {
                    key: 'Crop',
                    inputs: {
                      required: {
                        images: [
                          'COMFY_AUTOGROW_V3',
                          {
                            template: {
                              input: { required: { image: ['IMAGE', {}] } },
                              names: ['image_1', 'image_2'],
                              min: 1
                            }
                          }
                        ],
                        region: ['BOUNDING_BOX', { component: 'ImageCrop' }]
                      }
                    }
                  }
                ]
              }
            ]
          }
        },
        output: ['IMAGE'],
        output_name: ['IMAGE'],
        output_node: false
      }
      await route.fulfill({
        response,
        json: { ...definitions, [cropNode.name]: cropNode }
      })
    })
    await use(page)
  }
})

test.describe(
  'Image Crop with dynamic inputs',
  { tag: ['@widget', '@vue-nodes'] },
  () => {
    test('shows the connected image after reopening a dynamic-input crop node', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('widgets/image_crop_dynamic_inputs')

      const cropNode = comfyPage.vueNodes.getNodeLocator('2')
      await expect(cropNode).toBeVisible()
      await expect.soft(cropNode.getByTestId('crop-overlay')).toBeVisible()
      await expect.soft(cropNode.getByTestId('crop-empty-state')).toBeHidden()
    })
  }
)
