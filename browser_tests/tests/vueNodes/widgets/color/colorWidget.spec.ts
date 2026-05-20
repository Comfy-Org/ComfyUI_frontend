import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'

import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

const TEST_NODE_TYPE = 'TestColorWidgetDefaultNode'
const NON_BLACK_DEFAULT = '#00ff00'

const testColorNodeDef: ComfyNodeDef = {
  input: {
    required: {
      color: ['COLOR', { default: NON_BLACK_DEFAULT }]
    }
  },
  output: ['STRING'],
  output_is_list: [false],
  output_name: ['STRING'],
  name: TEST_NODE_TYPE,
  display_name: 'Test Color Widget Default Node',
  description: 'Synthetic node used to verify COLOR widget default handling.',
  category: 'testing',
  output_node: false,
  python_module: 'tests',
  deprecated: false,
  experimental: false
}

test.describe(
  'Vue Color Widget defaults (FE-800)',
  { tag: '@vue-nodes' },
  () => {
    test('respects a non-black default declared on the node input', async ({
      comfyPage
    }) => {
      await comfyPage.page.route(/\/object_info$/, async (route) => {
        const response = await route.fetch()
        const objectInfo = (await response.json()) as Record<
          string,
          ComfyNodeDef
        >
        objectInfo[TEST_NODE_TYPE] = testColorNodeDef
        await route.fulfill({ response, json: objectInfo })
      })

      await comfyPage.workflow.reloadAndWaitForApp()
      await comfyPage.vueNodes.waitForNodes()

      const nodeRef = await comfyPage.nodeOps.addNode(TEST_NODE_TYPE)
      await comfyPage.vueNodes.waitForNodes()

      const widget = await nodeRef.getWidgetByName('color')
      await expect.poll(() => widget.getValue()).toBe(NON_BLACK_DEFAULT)
    })
  }
)
