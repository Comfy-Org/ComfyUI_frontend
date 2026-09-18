import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import {
  patchPointerCapture,
  dispatchPointerEvent
} from '@e2e/fixtures/utils/pointerEventHelpers'

const SliderClasses = {
  pressed: /cursor-grabbing/
} as const

const SLIDER_NODE_ID = '12'
const SLIDER_SELECTOR = `[data-node-id="${SLIDER_NODE_ID}"] [data-slot="slider"]`

test.describe('Slider widget', { tag: ['@vue-nodes', '@screenshot'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('inputs/simple_slider')
    await patchPointerCapture(comfyPage.page)
  })

  test('Track click triggers pressed state on thumb', async ({ comfyPage }) => {
    const node = comfyPage.vueNodes.getNodeLocator(SLIDER_NODE_ID)
    const thumb = node.getByRole('slider')

    await comfyPage.page.evaluate(dispatchPointerEvent, {
      selector: SLIDER_SELECTOR,
      type: 'pointerdown'
    })
    await expect(thumb).toHaveClass(SliderClasses.pressed)

    await comfyPage.page.evaluate(dispatchPointerEvent, {
      selector: SLIDER_SELECTOR,
      type: 'pointerup'
    })
    await expect(thumb).not.toHaveClass(SliderClasses.pressed)
  })

  test('Keyboard adjusts slider value', async ({ comfyPage }) => {
    const node = comfyPage.vueNodes.getNodeLocator(SLIDER_NODE_ID)
    const thumb = node.getByRole('slider')

    await thumb.focus()
    await thumb.press('ArrowRight')

    await expect(node).toHaveScreenshot('slider_after_arrow_right.png')
  })
})
