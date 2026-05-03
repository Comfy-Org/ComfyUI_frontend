import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { WidgetBoundingBoxFixture } from '@e2e/fixtures/components/WidgetBoundingBox'

const NODE_ID = '1'

test.describe('Widget Bounding Box', { tag: ['@widget', '@vue-nodes'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('widgets/image_crop_widget')
  })

  test(
    'Renders all four coordinate inputs with workflow values',
    { tag: '@smoke' },
    async ({ comfyPage }) => {
      const node = comfyPage.vueNodes.getNodeLocator(NODE_ID)
      const boundingBox = new WidgetBoundingBoxFixture(node)

      await expect(boundingBox.root).toBeVisible()
      await expect(boundingBox.x.input).toHaveValue('0')
      await expect(boundingBox.y.input).toHaveValue('0')
      await expect(boundingBox.width.input).toHaveValue('512')
      await expect(boundingBox.height.input).toHaveValue('512')
    }
  )

  test('Typing into each coordinate updates only that coordinate', async ({
    comfyPage
  }) => {
    const node = comfyPage.vueNodes.getNodeLocator(NODE_ID)
    const boundingBox = new WidgetBoundingBoxFixture(node)

    await test.step('type X', async () => {
      await boundingBox.x.type(25)
      await expect(boundingBox.x.input).toHaveValue('25')
      await expect.soft(boundingBox.y.input).toHaveValue('0')
      await expect.soft(boundingBox.width.input).toHaveValue('512')
      await expect.soft(boundingBox.height.input).toHaveValue('512')
    })

    await test.step('type Y', async () => {
      await boundingBox.y.type(40)
      await expect(boundingBox.y.input).toHaveValue('40')
      await expect.soft(boundingBox.x.input).toHaveValue('25')
      await expect.soft(boundingBox.width.input).toHaveValue('512')
      await expect.soft(boundingBox.height.input).toHaveValue('512')
    })

    await test.step('type Width', async () => {
      await boundingBox.width.type(200)
      await expect(boundingBox.width.input).toHaveValue('200')
      await expect.soft(boundingBox.x.input).toHaveValue('25')
      await expect.soft(boundingBox.y.input).toHaveValue('40')
      await expect.soft(boundingBox.height.input).toHaveValue('512')
    })

    await test.step('type Height', async () => {
      await boundingBox.height.type(300)
      await expect(boundingBox.height.input).toHaveValue('300')
      await expect.soft(boundingBox.x.input).toHaveValue('25')
      await expect.soft(boundingBox.y.input).toHaveValue('40')
      await expect.soft(boundingBox.width.input).toHaveValue('200')
    })
  })

  test('Negative X/Y values are clamped to min=0', async ({ comfyPage }) => {
    const node = comfyPage.vueNodes.getNodeLocator(NODE_ID)
    const boundingBox = new WidgetBoundingBoxFixture(node)

    await boundingBox.x.type(50)
    await expect(boundingBox.x.input).toHaveValue('50')
    await boundingBox.x.type('-10')
    await expect(boundingBox.x.input).toHaveValue('0')

    await boundingBox.y.type(75)
    await expect(boundingBox.y.input).toHaveValue('75')
    await boundingBox.y.type('-50')
    await expect(boundingBox.y.input).toHaveValue('0')
  })

  test('Width/Height values below 1 are clamped to min=1', async ({
    comfyPage
  }) => {
    const node = comfyPage.vueNodes.getNodeLocator(NODE_ID)
    const boundingBox = new WidgetBoundingBoxFixture(node)

    await boundingBox.width.type(0)
    await expect(boundingBox.width.input).toHaveValue('1')

    await boundingBox.height.type('-5')
    await expect(boundingBox.height.input).toHaveValue('1')
  })

  test('Increment and decrement buttons change coordinate by step', async ({
    comfyPage
  }) => {
    const node = comfyPage.vueNodes.getNodeLocator(NODE_ID)
    const boundingBox = new WidgetBoundingBoxFixture(node)

    await test.step('increment X from 0 to 2', async () => {
      await boundingBox.x.increment()
      await boundingBox.x.increment()
      await expect(boundingBox.x.input).toHaveValue('2')
    })

    await test.step('decrement X from 2 to 1', async () => {
      await boundingBox.x.decrement()
      await expect(boundingBox.x.input).toHaveValue('1')
    })

    await test.step('decrement Width from 512 to 510', async () => {
      await boundingBox.width.decrement()
      await boundingBox.width.decrement()
      await expect(boundingBox.width.input).toHaveValue('510')
    })

    await test.step('increment Height from 512 to 513', async () => {
      await boundingBox.height.increment()
      await expect(boundingBox.height.input).toHaveValue('513')
    })
  })

  test('Arrow keys step the focused input; PageUp/PageDown step by 10', async ({
    comfyPage
  }) => {
    const node = comfyPage.vueNodes.getNodeLocator(NODE_ID)
    const boundingBox = new WidgetBoundingBoxFixture(node)

    await boundingBox.width.focus()

    await boundingBox.width.input.press('ArrowUp')
    await expect(boundingBox.width.input).toHaveValue('513')

    await boundingBox.width.input.press('ArrowDown')
    await boundingBox.width.input.press('ArrowDown')
    await expect(boundingBox.width.input).toHaveValue('511')

    await boundingBox.width.input.press('PageUp')
    await expect(boundingBox.width.input).toHaveValue('521')

    await boundingBox.width.input.press('PageDown')
    await expect(boundingBox.width.input).toHaveValue('511')
  })

  test('Decrement button is disabled when value equals min', async ({
    comfyPage
  }) => {
    const node = comfyPage.vueNodes.getNodeLocator(NODE_ID)
    const boundingBox = new WidgetBoundingBoxFixture(node)

    await test.step('X at 0 disables decrement', async () => {
      await expect(boundingBox.x.input).toHaveValue('0')
      await expect(boundingBox.x.decrementButton).toBeDisabled()
      await expect(boundingBox.x.incrementButton).toBeEnabled()
    })

    await test.step('Width at 1 disables decrement', async () => {
      await boundingBox.width.type(1)
      await expect(boundingBox.width.input).toHaveValue('1')
      await expect(boundingBox.width.decrementButton).toBeDisabled()
      await expect(boundingBox.width.incrementButton).toBeEnabled()
    })

    await test.step('Incrementing X re-enables decrement', async () => {
      await boundingBox.x.increment()
      await expect(boundingBox.x.decrementButton).toBeEnabled()
    })
  })

  test('Non-numeric input reverts to previous value on blur', async ({
    comfyPage
  }) => {
    const node = comfyPage.vueNodes.getNodeLocator(NODE_ID)
    const boundingBox = new WidgetBoundingBoxFixture(node)

    await boundingBox.x.type(42)
    await expect(boundingBox.x.input).toHaveValue('42')

    await boundingBox.x.input.fill('not a number')
    await boundingBox.x.input.blur()
    await expect(boundingBox.x.input).toHaveValue('42')
  })
})
