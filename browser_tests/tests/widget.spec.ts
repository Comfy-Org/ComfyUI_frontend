import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.describe('Combo text widget', () => {
  test('Truncates text when resized', async ({ comfyPage }) => {
    await comfyPage.resizeLoadCheckpointNode(0.2, 1)
    await expect(comfyPage.canvas).toHaveScreenshot(
      'load-checkpoint-resized-min-width.png'
    )
    await comfyPage.closeMenu()
    await comfyPage.resizeKsamplerNode(0.2, 1)
    await expect(comfyPage.canvas).toHaveScreenshot(
      `ksampler-resized-min-width.png`
    )
  })

  test("Doesn't truncate when space still available", async ({ comfyPage }) => {
    await comfyPage.resizeEmptyLatentNode(0.8, 0.8)
    await expect(comfyPage.canvas).toHaveScreenshot(
      'empty-latent-resized-80-percent.png'
    )
  })

  test('Can revert to full text', async ({ comfyPage }) => {
    await comfyPage.resizeLoadCheckpointNode(0.8, 1, true)
    await expect(comfyPage.canvas).toHaveScreenshot('resized-to-original.png')
  })

  test('should refresh combo values of optional inputs', async ({
    comfyPage
  }) => {
    const getComboValues = async () =>
      comfyPage.page.evaluate(() => {
        return window['app'].graph.nodes
          .find((node) => node.title === 'Node With Optional Combo Input')
          .widgets.find((widget) => widget.name === 'optional_combo_input')
          .options.values
      })

    await comfyPage.loadWorkflow('optional_combo_input')
    const initialComboValues = await getComboValues()

    // Focus canvas
    await comfyPage.page.mouse.click(400, 300)

    // Press R to trigger refresh
    await comfyPage.page.keyboard.press('r')

    // Wait for nodes' widgets to be updated
    await comfyPage.nextFrame()

    const refreshedComboValues = await getComboValues()
    expect(refreshedComboValues).not.toEqual(initialComboValues)
  })
})

test.describe('Boolean widget', () => {
  test('Can toggle', async ({ comfyPage }) => {
    await comfyPage.loadWorkflow('widgets/boolean_widget')
    await expect(comfyPage.canvas).toHaveScreenshot('boolean_widget.png')
    const node = (await comfyPage.getFirstNodeRef())!
    const widget = await node.getWidget(0)
    await widget.click()
    await expect(comfyPage.canvas).toHaveScreenshot(
      'boolean_widget_toggled.png'
    )
  })
})

test.describe('Slider widget', () => {
  test('Can drag adjust value', async ({ comfyPage }) => {
    await comfyPage.loadWorkflow('simple_slider')
    await comfyPage.page.waitForTimeout(300)
    const node = (await comfyPage.getFirstNodeRef())!
    const widget = await node.getWidget(0)

    await comfyPage.page.evaluate(() => {
      const widget = window['app'].graph.nodes[0].widgets[0]
      widget.callback = (value: number) => {
        window['widgetValue'] = value
      }
    })
    await widget.dragHorizontal(50)
    await expect(comfyPage.canvas).toHaveScreenshot('slider_widget_dragged.png')

    expect(
      await comfyPage.page.evaluate(() => window['widgetValue'])
    ).toBeDefined()
  })
})

test.describe('Number widget', () => {
  test('Can drag adjust value', async ({ comfyPage }) => {
    await comfyPage.loadWorkflow('widgets/seed_widget')
    await comfyPage.page.waitForTimeout(300)

    const node = (await comfyPage.getFirstNodeRef())!
    const widget = await node.getWidget(0)
    await comfyPage.page.evaluate(() => {
      const widget = window['app'].graph.nodes[0].widgets[0]
      widget.callback = (value: number) => {
        window['widgetValue'] = value
      }
    })
    await widget.dragHorizontal(50)
    await expect(comfyPage.canvas).toHaveScreenshot('seed_widget_dragged.png')

    expect(
      await comfyPage.page.evaluate(() => window['widgetValue'])
    ).toBeDefined()
  })
})

test.describe('Dynamic widget manipulation', () => {
  test('Auto expand node when widget is added dynamically', async ({
    comfyPage
  }) => {
    await comfyPage.loadWorkflow('single_ksampler')
    await comfyPage.page.waitForTimeout(300)

    await comfyPage.page.evaluate(() => {
      window['graph'].nodes[0].addWidget('number', 'new_widget', 10)
      window['graph'].setDirtyCanvas(true, true)
    })

    await expect(comfyPage.canvas).toHaveScreenshot('ksampler_widget_added.png')
  })
})

test.describe('Image widget', () => {
  test('Can load image', async ({ comfyPage }) => {
    await comfyPage.loadWorkflow('widgets/load_image_widget')
    await expect(comfyPage.canvas).toHaveScreenshot('load_image_widget.png')
  })

  test('Can drag and drop image', async ({ comfyPage }) => {
    await comfyPage.loadWorkflow('widgets/load_image_widget')

    // Get position of the load image node
    const nodes = await comfyPage.getNodeRefsByType('LoadImage')
    const loadImageNode = nodes[0]
    const { x, y } = await loadImageNode.getPosition()

    // Drag and drop image file onto the load image node
    await comfyPage.dragAndDropFile('image32x32.webp', {
      dropPosition: { x, y }
    })

    // Expect the image preview to change automatically
    await expect(comfyPage.canvas).toHaveScreenshot(
      'image_preview_drag_and_dropped.png'
    )

    // Expect the filename combo value to be updated
    const fileComboWidget = await loadImageNode.getWidget(0)
    const filename = await fileComboWidget.getValue()
    expect(filename).toBe('image32x32.webp')
  })

  test('Can change image by changing the filename combo value', async ({
    comfyPage
  }) => {
    await comfyPage.loadWorkflow('widgets/load_image_widget')
    const nodes = await comfyPage.getNodeRefsByType('LoadImage')
    const loadImageNode = nodes[0]

    // Click the combo widget used to select the image filename
    const fileComboWidget = await loadImageNode.getWidget(0)
    await fileComboWidget.click()

    // Select a new image filename value from the combo context menu
    const comboEntry = comfyPage.page.getByRole('menuitem', {
      name: 'image32x32.webp'
    })
    await comboEntry.click({ noWaitAfter: true })

    // Expect the image preview to change automatically
    await expect(comfyPage.canvas).toHaveScreenshot(
      'image_preview_changed_by_combo_value.png'
    )

    // Expect the filename combo value to be updated
    const filename = await fileComboWidget.getValue()
    expect(filename).toBe('image32x32.webp')
  })
})

test.describe('Load audio widget', () => {
  test('Can load audio', async ({ comfyPage }) => {
    await comfyPage.loadWorkflow('widgets/load_audio_widget')
    await expect(comfyPage.canvas).toHaveScreenshot('load_audio_widget.png')
  })
})
