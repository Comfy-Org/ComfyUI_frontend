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

  test('Should refresh combo values of nodes with v2 combo input spec', async ({
    comfyPage
  }) => {
    await comfyPage.loadWorkflow('node_with_v2_combo_input')
    // click canvas to focus
    await comfyPage.page.mouse.click(400, 300)
    // press R to trigger refresh
    await comfyPage.page.keyboard.press('r')
    // wait for nodes' widgets to be updated
    await comfyPage.page.mouse.click(400, 300)
    await comfyPage.nextFrame()
    // get the combo widget's values
    const comboValues = await comfyPage.page.evaluate(() => {
      return window['app'].graph.nodes
        .find((node) => node.title === 'Node With V2 Combo Input')
        .widgets.find((widget) => widget.name === 'combo_input').options.values
    })
    expect(comboValues).toEqual(['A', 'B'])
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

test.describe('Animated image widget', () => {
  // https://github.com/Comfy-Org/ComfyUI_frontend/issues/3718
  test.skip('Shows preview of uploaded animated image', async ({
    comfyPage
  }) => {
    await comfyPage.loadWorkflow('widgets/load_animated_webp')

    // Get position of the load animated webp node
    const nodes = await comfyPage.getNodeRefsByType(
      'DevToolsLoadAnimatedImageTest'
    )
    const loadAnimatedWebpNode = nodes[0]
    const { x, y } = await loadAnimatedWebpNode.getPosition()

    // Drag and drop image file onto the load animated webp node
    await comfyPage.dragAndDropFile('animated_webp.webp', {
      dropPosition: { x, y }
    })

    // Expect the image preview to change automatically
    await expect(comfyPage.canvas).toHaveScreenshot(
      'animated_image_preview_drag_and_dropped.png'
    )

    // Wait for animation to go to next frame
    await comfyPage.page.waitForTimeout(512)

    // Move mouse and click on canvas to trigger render
    await comfyPage.page.mouse.click(64, 64)

    // Expect the image preview to change to the next frame of the animation
    await expect(comfyPage.canvas).toHaveScreenshot(
      'animated_image_preview_drag_and_dropped_next_frame.png'
    )
  })

  test('Can drag-and-drop animated webp image', async ({ comfyPage }) => {
    await comfyPage.loadWorkflow('widgets/load_animated_webp')

    // Get position of the load animated webp node
    const nodes = await comfyPage.getNodeRefsByType(
      'DevToolsLoadAnimatedImageTest'
    )
    const loadAnimatedWebpNode = nodes[0]
    const { x, y } = await loadAnimatedWebpNode.getPosition()

    // Drag and drop image file onto the load animated webp node
    await comfyPage.dragAndDropFile('animated_webp.webp', {
      dropPosition: { x, y }
    })

    // Expect the filename combo value to be updated
    const fileComboWidget = await loadAnimatedWebpNode.getWidget(0)
    const filename = await fileComboWidget.getValue()
    expect(filename).toContain('animated_webp.webp')
  })

  test('Can preview saved animated webp image', async ({ comfyPage }) => {
    await comfyPage.loadWorkflow('widgets/save_animated_webp')

    // Get position of the load animated webp node
    const loadNodes = await comfyPage.getNodeRefsByType(
      'DevToolsLoadAnimatedImageTest'
    )
    const loadAnimatedWebpNode = loadNodes[0]
    const { x, y } = await loadAnimatedWebpNode.getPosition()

    // Drag and drop image file onto the load animated webp node
    await comfyPage.dragAndDropFile('animated_webp.webp', {
      dropPosition: { x, y }
    })
    await comfyPage.nextFrame()

    // Get the SaveAnimatedWEBP node
    const saveNodes = await comfyPage.getNodeRefsByType('SaveAnimatedWEBP')
    const saveAnimatedWebpNode = saveNodes[0]
    if (!saveAnimatedWebpNode)
      throw new Error('SaveAnimatedWEBP node not found')

    // Simulate the graph executing
    await comfyPage.page.evaluate(
      ([loadId, saveId]) => {
        // Set the output of the SaveAnimatedWEBP node to equal the loader node's image
        window['app'].nodeOutputs[saveId] = window['app'].nodeOutputs[loadId]
      },
      [loadAnimatedWebpNode.id, saveAnimatedWebpNode.id]
    )
    await comfyPage.nextFrame()

    // Wait for animation to go to next frame
    await comfyPage.page.waitForTimeout(512)

    // Move mouse and click on canvas to trigger render
    await comfyPage.page.mouse.click(64, 64)

    // Expect the SaveAnimatedWEBP node to have an output preview
    await expect(comfyPage.canvas).toHaveScreenshot(
      'animated_image_preview_saved_webp.png'
    )
  })
})

test.describe('Load audio widget', () => {
  test('Can load audio', async ({ comfyPage }) => {
    await comfyPage.loadWorkflow('widgets/load_audio_widget')
    await expect(comfyPage.canvas).toHaveScreenshot('load_audio_widget.png')
  })
})

test.describe('Unserialized widgets', () => {
  test('Unserialized widgets values do not mark graph as modified', async ({
    comfyPage
  }) => {
    // Add workflow w/ LoadImage node, which contains file upload and image preview widgets (not serialized)
    await comfyPage.loadWorkflow('widgets/load_image_widget')

    // Move mouse and click to trigger the `graphEqual` check in `changeTracker.ts`
    await comfyPage.page.mouse.move(10, 10)
    await comfyPage.page.mouse.click(10, 10)

    // Expect the graph to not be modified
    expect(await comfyPage.isCurrentWorkflowModified()).toBe(false)
  })
})
