import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '../fixtures/ComfyPage'

/** One representative of each widget type from the default workflow. */
type WidgetType = 'textarea' | 'number' | 'select' | 'text'

const WIDGET_TEST_DATA: {
  key: string
  type: WidgetType
  fill: string
  expected: unknown
}[] = [
  {
    key: '6:text',
    type: 'textarea',
    fill: 'test prompt',
    expected: 'test prompt'
  },
  { key: '5:width', type: 'number', fill: '768', expected: 768 },
  { key: '3:cfg', type: 'number', fill: '3.5', expected: 3.5 },
  { key: '3:sampler_name', type: 'select', fill: 'uni_pc', expected: 'uni_pc' },
  {
    key: '9:filename_prefix',
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
    const inputs: [string, string][] = WIDGET_TEST_DATA.map(({ key }) => {
      const [nodeId, widgetName] = key.split(':')
      return [nodeId, widgetName]
    })
    await appMode.enterAppModeWithInputs(inputs)
    await expect(appMode.linearWidgets).toBeVisible({ timeout: 5000 })

    for (const { key, type, fill } of WIDGET_TEST_DATA) {
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

    for (const { key, expected } of WIDGET_TEST_DATA) {
      const [nodeId, widgetName] = key.split(':')
      expect(prompt[nodeId].inputs[widgetName]).toBe(expected)
    }
  })
})
