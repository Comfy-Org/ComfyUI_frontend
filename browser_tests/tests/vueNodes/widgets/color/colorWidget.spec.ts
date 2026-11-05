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

test.describe(
  'Vue integer color widget',
  { tag: ['@vue-nodes', '@node', '@widget'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow(
        'vueNodes/empty-image-integer-color'
      )
    })

    test('round-trips packed RGB values without alpha', async ({
      comfyPage
    }) => {
      const colorWidget = comfyPage.vueNodes.getWidgetRowByLabel(
        'Empty Image',
        'color'
      )
      await expect(colorWidget).toContainText('#000000')

      await colorWidget.getByRole('button').click()
      await expect(comfyPage.page.getByLabel('Alpha')).toHaveCount(0)

      const hexInput = comfyPage.page.getByLabel('Hex')
      await hexInput.fill('#00ff00')
      await expect(colorWidget).toContainText('#00ff00')

      await expect
        .poll(() =>
          comfyPage.page.evaluate(() => {
            const node = window.app!.graph.nodes.find(
              (node) => node.type === 'EmptyImage'
            )!
            const widgetIndex = node.widgets!.findIndex(
              (widget) => widget.name === 'color'
            )
            return {
              value: node.widgets![widgetIndex].value,
              serializedValue: node.serialize().widgets_values?.[widgetIndex]
            }
          })
        )
        .toEqual({ value: 0x00ff00, serializedValue: 0x00ff00 })
    })
  }
)
