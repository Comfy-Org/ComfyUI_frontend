import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'
import { PerformanceMonitor } from '../helpers/performanceMonitor'

test.describe('Combo text widget', () => {
  test.skip('@perf Truncates text when resized', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'combo-widget-resize-truncation'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation(
      'resize-load-checkpoint-node',
      async () => {
        await comfyPage.resizeLoadCheckpointNode(0.2, 1)
      }
    )

    await expect(comfyPage.canvas).toHaveScreenshot(
      'load-checkpoint-resized-min-width.png'
    )

    await perfMonitor.measureOperation('close-menu', async () => {
      await comfyPage.closeMenu()
    })

    await perfMonitor.measureOperation('resize-ksampler-node', async () => {
      await comfyPage.resizeKsamplerNode(0.2, 1)
    })

    await expect(comfyPage.canvas).toHaveScreenshot(
      `ksampler-resized-min-width.png`
    )

    await perfMonitor.finishMonitoring(testName)
  })

  test("@perf Doesn't truncate when space still available", async ({
    comfyPage
  }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'combo-widget-no-truncation'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('resize-empty-latent-node', async () => {
      await comfyPage.resizeEmptyLatentNode(0.8, 0.8)
    })

    await expect(comfyPage.canvas).toHaveScreenshot(
      'empty-latent-resized-80-percent.png'
    )

    await perfMonitor.finishMonitoring(testName)
  })

  test('@perf Can revert to full text', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'combo-widget-revert-text'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('resize-to-original', async () => {
      await comfyPage.resizeLoadCheckpointNode(0.8, 1, true)
    })

    await expect(comfyPage.canvas).toHaveScreenshot('resized-to-original.png')

    await perfMonitor.finishMonitoring(testName)
  })

  // Skip because fails with vue widget nodes (reason not investigated)
  test.skip('@perf should refresh combo values of optional inputs', async ({
    comfyPage
  }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'combo-widget-refresh-optional-inputs'

    await perfMonitor.startMonitoring(testName)

    const getComboValues = async () =>
      comfyPage.page.evaluate(() => {
        return window['app'].graph.nodes
          .find((node) => node.title === 'Node With Optional Combo Input')
          .widgets.find((widget) => widget.name === 'optional_combo_input')
          .options.values
      })

    await perfMonitor.measureOperation('load-workflow', async () => {
      await comfyPage.loadWorkflow('optional_combo_input')
    })

    let initialComboValues: any
    await perfMonitor.measureOperation('get-initial-combo-values', async () => {
      initialComboValues = await getComboValues()
    })

    await perfMonitor.measureOperation('focus-canvas', async () => {
      await comfyPage.page.mouse.click(400, 300)
    })

    await perfMonitor.measureOperation('trigger-refresh', async () => {
      await comfyPage.page.keyboard.press('r')
    })

    await perfMonitor.measureOperation('wait-for-update', async () => {
      await comfyPage.nextFrame()
    })

    let refreshedComboValues: any
    await perfMonitor.measureOperation(
      'get-refreshed-combo-values',
      async () => {
        refreshedComboValues = await getComboValues()
      }
    )

    expect(refreshedComboValues).not.toEqual(initialComboValues!)

    await perfMonitor.finishMonitoring(testName)
  })

  test.skip('@perf Should refresh combo values of nodes with v2 combo input spec', async ({
    comfyPage
  }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'combo-widget-v2-refresh'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('load-v2-workflow', async () => {
      await comfyPage.loadWorkflow('node_with_v2_combo_input')
    })

    await perfMonitor.measureOperation('focus-canvas', async () => {
      await comfyPage.page.mouse.click(400, 300)
    })

    await perfMonitor.measureOperation('trigger-refresh', async () => {
      await comfyPage.page.keyboard.press('r')
    })

    await perfMonitor.measureOperation('wait-for-update', async () => {
      await comfyPage.page.mouse.click(400, 300)
      await comfyPage.nextFrame()
    })

    let comboValues: any
    await perfMonitor.measureOperation('get-combo-values', async () => {
      comboValues = await comfyPage.page.evaluate(() => {
        return window['app'].graph.nodes
          .find((node) => node.title === 'Node With V2 Combo Input')
          .widgets.find((widget) => widget.name === 'combo_input').options
          .values
      })
    })

    expect(comboValues!).toEqual(['A', 'B'])

    await perfMonitor.finishMonitoring(testName)
  })
})

test.describe('Boolean widget', () => {
  test('@perf Can toggle', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'boolean-widget-toggle'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('load-boolean-workflow', async () => {
      await comfyPage.loadWorkflow('widgets/boolean_widget')
    })

    await expect(comfyPage.canvas).toHaveScreenshot('boolean_widget.png')

    let node: any
    await perfMonitor.measureOperation('get-node-reference', async () => {
      node = (await comfyPage.getFirstNodeRef())!
    })

    let widget: any
    await perfMonitor.measureOperation('get-widget-reference', async () => {
      widget = await node.getWidget(0)
    })

    await perfMonitor.measureOperation('toggle-boolean-widget', async () => {
      await widget.click()
    })

    await expect(comfyPage.canvas).toHaveScreenshot(
      'boolean_widget_toggled.png'
    )

    await perfMonitor.finishMonitoring(testName)
  })
})

test.describe('Slider widget', () => {
  test.skip('@perf Can drag adjust value', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'slider-widget-drag-value'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('load-slider-workflow', async () => {
      await comfyPage.loadWorkflow('simple_slider')
      await comfyPage.page.waitForTimeout(300)
    })

    let node: any
    await perfMonitor.measureOperation('get-node-reference', async () => {
      node = (await comfyPage.getFirstNodeRef())!
    })

    let widget: any
    await perfMonitor.measureOperation('get-widget-reference', async () => {
      widget = await node.getWidget(0)
    })

    await perfMonitor.measureOperation('setup-widget-callback', async () => {
      await comfyPage.page.evaluate(() => {
        const widget = window['app'].graph.nodes[0].widgets[0]
        widget.callback = (value: number) => {
          window['widgetValue'] = value
        }
      })
    })

    await perfMonitor.measureOperation('drag-slider-widget', async () => {
      await widget.dragHorizontal(50)
    })

    await expect(comfyPage.canvas).toHaveScreenshot('slider_widget_dragged.png')

    expect(
      await comfyPage.page.evaluate(() => window['widgetValue'])
    ).toBeDefined()

    await perfMonitor.finishMonitoring(testName)
  })
})

test.describe('Number widget', () => {
  test.skip('@perf Can drag adjust value', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'number-widget-drag-value'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('load-seed-workflow', async () => {
      await comfyPage.loadWorkflow('widgets/seed_widget')
      await comfyPage.page.waitForTimeout(300)
    })

    let node: any
    await perfMonitor.measureOperation('get-node-reference', async () => {
      node = (await comfyPage.getFirstNodeRef())!
    })

    let widget: any
    await perfMonitor.measureOperation('get-widget-reference', async () => {
      widget = await node.getWidget(0)
    })

    await perfMonitor.measureOperation('setup-widget-callback', async () => {
      await comfyPage.page.evaluate(() => {
        const widget = window['app'].graph.nodes[0].widgets[0]
        widget.callback = (value: number) => {
          window['widgetValue'] = value
        }
      })
    })

    await perfMonitor.measureOperation('drag-number-widget', async () => {
      await widget.dragHorizontal(50)
    })

    await expect(comfyPage.canvas).toHaveScreenshot('seed_widget_dragged.png')

    expect(
      await comfyPage.page.evaluate(() => window['widgetValue'])
    ).toBeDefined()

    await perfMonitor.finishMonitoring(testName)
  })
})

test.describe('Dynamic widget manipulation', () => {
  test('@perf Auto expand node when widget is added dynamically', async ({
    comfyPage
  }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'dynamic-widget-addition'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('load-ksampler-workflow', async () => {
      await comfyPage.loadWorkflow('single_ksampler')
      await comfyPage.page.waitForTimeout(300)
    })

    await perfMonitor.measureOperation('add-dynamic-widget', async () => {
      await comfyPage.page.evaluate(() => {
        window['graph'].nodes[0].addWidget('number', 'new_widget', 10)
        window['graph'].setDirtyCanvas(true, true)
      })
    })

    await expect(comfyPage.canvas).toHaveScreenshot('ksampler_widget_added.png')

    await perfMonitor.finishMonitoring(testName)
  })
})

test.describe('Image widget', () => {
  // Skip because fails with vue widget nodes (reason not investigated)
  test.skip('@perf Can load image', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'image-widget-load'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('load-image-workflow', async () => {
      await comfyPage.loadWorkflow('widgets/load_image_widget')
    })

    await expect(comfyPage.canvas).toHaveScreenshot('load_image_widget.png')

    await perfMonitor.finishMonitoring(testName)
  })

  test.skip('@perf Can drag and drop image', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'image-widget-drag-drop'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('load-image-workflow', async () => {
      await comfyPage.loadWorkflow('widgets/load_image_widget')
    })

    let nodes: any
    let loadImageNode: any
    let position: any
    await perfMonitor.measureOperation('get-load-image-node', async () => {
      nodes = await comfyPage.getNodeRefsByType('LoadImage')
      loadImageNode = nodes[0]
      position = await loadImageNode.getPosition()
    })

    await perfMonitor.measureOperation('drag-drop-image-file', async () => {
      await comfyPage.dragAndDropFile('image32x32.webp', {
        dropPosition: { x: position.x, y: position.y }
      })
    })

    await expect(comfyPage.canvas).toHaveScreenshot(
      'image_preview_drag_and_dropped.png'
    )

    let fileComboWidget: any
    let filename: any
    await perfMonitor.measureOperation('get-updated-filename', async () => {
      fileComboWidget = await loadImageNode.getWidget(0)
      filename = await fileComboWidget.getValue()
    })

    expect(filename!).toBe('image32x32.webp')

    await perfMonitor.finishMonitoring(testName)
  })

  // Skip because fails with vue widget nodes (reason not investigated)
  test.skip('@perf Can change image by changing the filename combo value', async ({
    comfyPage
  }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'image-widget-combo-change'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('load-image-workflow', async () => {
      await comfyPage.loadWorkflow('widgets/load_image_widget')
    })

    let nodes: any
    let loadImageNode: any
    await perfMonitor.measureOperation('get-load-image-node', async () => {
      nodes = await comfyPage.getNodeRefsByType('LoadImage')
      loadImageNode = nodes[0]
    })

    let fileComboWidget: any
    await perfMonitor.measureOperation('click-combo-widget', async () => {
      fileComboWidget = await loadImageNode.getWidget(0)
      await fileComboWidget.click()
    })

    await perfMonitor.measureOperation('select-combo-entry', async () => {
      const comboEntry = comfyPage.page.getByRole('menuitem', {
        name: 'image32x32.webp'
      })
      await comboEntry.click({ noWaitAfter: true })
    })

    await expect(comfyPage.canvas).toHaveScreenshot(
      'image_preview_changed_by_combo_value.png'
    )

    let filename: any
    await perfMonitor.measureOperation('get-updated-filename', async () => {
      filename = await fileComboWidget.getValue()
    })

    expect(filename!).toBe('image32x32.webp')

    await perfMonitor.finishMonitoring(testName)
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

  test.skip('@perf Can drag-and-drop animated webp image', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'animated-image-widget-drag-drop'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation(
      'load-animated-webp-workflow',
      async () => {
        await comfyPage.loadWorkflow('widgets/load_animated_webp')
      }
    )

    let nodes: any
    let loadAnimatedWebpNode: any
    let position: any
    await perfMonitor.measureOperation('get-animated-webp-node', async () => {
      nodes = await comfyPage.getNodeRefsByType('DevToolsLoadAnimatedImageTest')
      loadAnimatedWebpNode = nodes[0]
      position = await loadAnimatedWebpNode.getPosition()
    })

    await perfMonitor.measureOperation('drag-drop-animated-webp', async () => {
      await comfyPage.dragAndDropFile('animated_webp.webp', {
        dropPosition: { x: position.x, y: position.y }
      })
    })

    let fileComboWidget: any
    let filename: any
    await perfMonitor.measureOperation('get-updated-filename', async () => {
      fileComboWidget = await loadAnimatedWebpNode.getWidget(0)
      filename = await fileComboWidget.getValue()
    })

    expect(filename!).toContain('animated_webp.webp')

    await perfMonitor.finishMonitoring(testName)
  })

  test('@perf Can preview saved animated webp image', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'animated-image-widget-save-preview'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation(
      'load-save-animated-workflow',
      async () => {
        await comfyPage.loadWorkflow('widgets/save_animated_webp')
      }
    )

    let loadNodes: any
    let loadAnimatedWebpNode: any
    let position: any
    await perfMonitor.measureOperation('get-load-node', async () => {
      loadNodes = await comfyPage.getNodeRefsByType(
        'DevToolsLoadAnimatedImageTest'
      )
      loadAnimatedWebpNode = loadNodes[0]
      position = await loadAnimatedWebpNode.getPosition()
    })

    await perfMonitor.measureOperation('drag-drop-animated-file', async () => {
      await comfyPage.dragAndDropFile('animated_webp.webp', {
        dropPosition: { x: position.x, y: position.y }
      })
      await comfyPage.nextFrame()
    })

    let saveNodes: any
    let saveAnimatedWebpNode: any
    await perfMonitor.measureOperation('get-save-node', async () => {
      saveNodes = await comfyPage.getNodeRefsByType('SaveAnimatedWEBP')
      saveAnimatedWebpNode = saveNodes[0]
      if (!saveAnimatedWebpNode)
        throw new Error('SaveAnimatedWEBP node not found')
    })

    await perfMonitor.measureOperation('simulate-graph-execution', async () => {
      await comfyPage.page.evaluate(
        ([loadId, saveId]) => {
          // Set the output of the SaveAnimatedWEBP node to equal the loader node's image
          window['app'].nodeOutputs[saveId] = window['app'].nodeOutputs[loadId]
        },
        [loadAnimatedWebpNode.id, saveAnimatedWebpNode.id]
      )
      await comfyPage.nextFrame()
    })

    await perfMonitor.measureOperation('wait-for-animation-frame', async () => {
      await comfyPage.page.waitForTimeout(512)
    })

    await perfMonitor.measureOperation('trigger-render', async () => {
      await comfyPage.page.mouse.click(64, 64)
    })

    await expect(comfyPage.canvas).toHaveScreenshot(
      'animated_image_preview_saved_webp.png'
    )

    await perfMonitor.finishMonitoring(testName)
  })
})

test.describe('Load audio widget', () => {
  // Skip because fails with vue widget nodes (reason not investigated)
  test.skip('@perf Can load audio', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'audio-widget-load'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('load-audio-workflow', async () => {
      await comfyPage.loadWorkflow('widgets/load_audio_widget')
    })

    await expect(comfyPage.canvas).toHaveScreenshot('load_audio_widget.png')

    await perfMonitor.finishMonitoring(testName)
  })
})

test.describe('Unserialized widgets', () => {
  test.skip('@perf Unserialized widgets values do not mark graph as modified', async ({
    comfyPage
  }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'unserialized-widget-modification-check'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation(
      'load-image-widget-workflow',
      async () => {
        await comfyPage.loadWorkflow('widgets/load_image_widget')
      }
    )

    await perfMonitor.measureOperation(
      'trigger-graph-equal-check',
      async () => {
        await comfyPage.page.mouse.move(10, 10)
        await comfyPage.page.mouse.click(10, 10)
      }
    )

    let isModified: any
    await perfMonitor.measureOperation(
      'check-workflow-modified-status',
      async () => {
        isModified = await comfyPage.isCurrentWorkflowModified()
      }
    )

    expect(isModified!).toBe(false)

    await perfMonitor.finishMonitoring(testName)
  })
})
