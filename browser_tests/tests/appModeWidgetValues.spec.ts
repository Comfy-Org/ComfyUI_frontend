import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'

/** One representative of each widget type from the default workflow. */
type WidgetType = 'textarea' | 'number' | 'select' | 'text'

const WIDGET_TEST_DATA: {
  nodeId: string
  widgetName: string
  type: WidgetType
  fill: string
  expected: unknown
}[] = [
  {
    nodeId: '6',
    widgetName: 'text',
    type: 'textarea',
    fill: 'test prompt',
    expected: 'test prompt'
  },
  {
    nodeId: '5',
    widgetName: 'width',
    type: 'number',
    fill: '768',
    expected: 768
  },
  {
    nodeId: '3',
    widgetName: 'cfg',
    type: 'number',
    fill: '3.5',
    expected: 3.5
  },
  {
    nodeId: '3',
    widgetName: 'sampler_name',
    type: 'select',
    fill: 'uni_pc',
    expected: 'uni_pc'
  },
  {
    nodeId: '9',
    widgetName: 'filename_prefix',
    type: 'text',
    fill: 'test_prefix',
    expected: 'test_prefix'
  }
]

test.describe('App mode widget values in prompt', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.appMode.enableLinearMode()
  })

  test('Widget values are sent correctly in prompt POST', async ({
    comfyPage
  }) => {
    const { appMode } = comfyPage
    const inputs: [string, string][] = WIDGET_TEST_DATA.map(
      ({ nodeId, widgetName }) => [nodeId, widgetName]
    )
    await appMode.enterAppModeWithInputs(inputs)
    await expect(appMode.linearWidgets).toBeVisible()

    for (const { nodeId, widgetName, type, fill } of WIDGET_TEST_DATA) {
      const key = `${nodeId}:${widgetName}`
      switch (type) {
        case 'textarea':
          await appMode.widgets.fillTextarea(key, fill)
          break
        case 'number':
          await appMode.widgets.fillNumber(key, fill)
          break
        case 'select':
          await appMode.widgets.selectOption(key, fill)
          break
        case 'text':
          await appMode.widgets.fillText(key, fill)
          break
        default:
          throw new Error(`Unknown widget type: ${type satisfies never}`)
      }
    }

    const prompt = await appMode.widgets.runAndCapturePrompt()

    for (const { nodeId, widgetName, expected } of WIDGET_TEST_DATA) {
      expect(prompt[nodeId].inputs[widgetName]).toBe(expected)
    }
  })
})
