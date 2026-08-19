import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

const COLOR_NODE_DISPLAY_NAME = 'Node With Color Input'
const DECLARED_DEFAULT = '#00ff00'
const PERSISTED_VALUE = '#ff00ff'

test.describe('Vue Color Widget defaults', { tag: '@vue-nodes' }, () => {
  test('respects the declared default value in the input spec', async ({
    comfyPage
  }) => {
    await comfyPage.searchBoxV2.addNode(COLOR_NODE_DISPLAY_NAME)

    const node = comfyPage.vueNodes.getNodeByTitle(COLOR_NODE_DISPLAY_NAME)
    const colorTrigger = node.getByRole('button', {
      name: new RegExp(DECLARED_DEFAULT, 'i')
    })

    await expect(colorTrigger).toBeVisible()
  })

  test('restores a saved color value when loading a workflow', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('vueNodes/color-widget-default')

    const node = comfyPage.vueNodes.getNodeByTitle(COLOR_NODE_DISPLAY_NAME)
    const colorTrigger = node.getByRole('button', {
      name: new RegExp(PERSISTED_VALUE, 'i')
    })

    await expect(colorTrigger).toBeVisible()
  })
})
