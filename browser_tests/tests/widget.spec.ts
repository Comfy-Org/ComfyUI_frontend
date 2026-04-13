import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { DefaultGraphPositions } from '@e2e/fixtures/constants/defaultGraphPositions'
import { getNodeClipRegion } from '@e2e/fixtures/utils/screenshotClip'

test.beforeEach(async ({ comfyPage }) => {
  await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
  await comfyPage.closeMenu()
})

test.describe('Combo text widget', { tag: ['@screenshot', '@widget'] }, () => {
  test('Truncates text when resized', async ({ comfyPage }) => {
    await comfyPage.nodeOps.resizeNode(
      DefaultGraphPositions.loadCheckpoint.pos,
      DefaultGraphPositions.loadCheckpoint.size,
      0.2,
      1
    )
    const loadCheckpointNode = (
      await comfyPage.nodeOps.getNodeRefsByTitle('Load Checkpoint')
    )[0]
    const loadCheckpointClip = await getNodeClipRegion(comfyPage, [
      loadCheckpointNode.id
    ])
    await expect(comfyPage.page).toHaveScreenshot(
      'load-checkpoint-resized-min-width.png',
      { clip: loadCheckpointClip }
    )
    await comfyPage.nodeOps.resizeNode(
      DefaultGraphPositions.ksampler.pos,
      DefaultGraphPositions.ksampler.size,
      0.2,
      1
    )
    const ksamplerNode = (
      await comfyPage.nodeOps.getNodeRefsByTitle('KSampler')
    )[0]
    const ksamplerClip = await getNodeClipRegion(comfyPage, [ksamplerNode.id])
    await expect(comfyPage.page).toHaveScreenshot(
      `ksampler-resized-min-width.png`,
      { clip: ksamplerClip }
    )
  })

  test("Doesn't truncate when space still available", async ({ comfyPage }) => {
    await comfyPage.nodeOps.resizeNode(
      DefaultGraphPositions.emptyLatent.pos,
      DefaultGraphPositions.emptyLatent.size,
      0.8,
      0.8
    )
    const emptyLatentNode = (
      await comfyPage.nodeOps.getNodeRefsByTitle('Empty Latent Image')
    )[0]
    const clip = await getNodeClipRegion(comfyPage, [emptyLatentNode.id])
    await expect(comfyPage.page).toHaveScreenshot(
      'empty-latent-resized-80-percent.png',
      { clip }
    )
  })

  test('Can revert to full text', async ({ comfyPage }) => {
    await comfyPage.nodeOps.resizeNode(
      DefaultGraphPositions.loadCheckpoint.pos,
      DefaultGraphPositions.loadCheckpoint.size,
      0.8,
      1,
      true
    )
    const loadCheckpointNode = (
      await comfyPage.nodeOps.getNodeRefsByTitle('Load Checkpoint')
    )[0]
    const clip = await getNodeClipRegion(comfyPage, [loadCheckpointNode.id])
    await expect(comfyPage.page).toHaveScreenshot('resized-to-original.png', {
      clip
    })
  })

  test('should refresh combo values of optional inputs', async ({
    comfyPage
  }) => {
    const getComboValues = async () =>
      comfyPage.page.evaluate(() => {
        return window
          .app!.graph!.nodes.find(
            (node) => node.title === 'Node With Optional Combo Input'
          )!
          .widgets!.find((widget) => widget.name === 'optional_combo_input')!
          .options.values
      })

    await comfyPage.workflow.loadWorkflow('inputs/optional_combo_input')
    const initialComboValues = await getComboValues()

    // Focus canvas
    await comfyPage.page.mouse.click(400, 300)

    // Press R to trigger refresh
    await comfyPage.page.keyboard.press('r')

    // Wait for nodes' widgets to be updated
    await expect.poll(() => getComboValues()).not.toEqual(initialComboValues)
  })

  test('Should refresh combo values of nodes with v2 combo input spec', async ({
    comfyPage
  }) => {
    const getComboValues = async () =>
      comfyPage.page.evaluate(() => {
        return window
          .app!.graph!.nodes.find(
            (node) => node.title === 'Node With V2 Combo Input'
          )!
          .widgets!.find((widget) => widget.name === 'combo_input')!.options
          .values
      })

    await comfyPage.workflow.loadWorkflow('inputs/node_with_v2_combo_input')
    // click canvas to focus
    await comfyPage.page.mouse.click(400, 300)
    // press R to trigger refresh
    await comfyPage.page.keyboard.press('r')

    await expect.poll(() => getComboValues()).toEqual(['A', 'B'])
  })
})

test.describe('Boolean widget', { tag: ['@screenshot', '@widget'] }, () => {
  test('Can toggle', async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('widgets/boolean_widget')
    const node = (await comfyPage.nodeOps.getFirstNodeRef())!
    const clip = await getNodeClipRegion(comfyPage, [node.id])
    await expect(comfyPage.page).toHaveScreenshot('boolean_widget.png', {
      clip
    })
    const widget = await node.getWidget(0)
    await widget.click()
    await expect(comfyPage.page).toHaveScreenshot(
      'boolean_widget_toggled.png',
      { clip }
    )
  })
})

test.describe('Slider widget', { tag: ['@screenshot', '@widget'] }, () => {
  test('Can drag adjust value', async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('inputs/simple_slider')
    const node = (await comfyPage.nodeOps.getFirstNodeRef())!
    const widget = await node.getWidget(0)

    await comfyPage.page.evaluate(() => {
      window.widgetValue = undefined
      const widget = window.app!.graph!.nodes[0].widgets![0]
      widget.callback = (value: number) => {
        window.widgetValue = value
      }
    })
    await widget.dragHorizontal(50)
    const clip = await getNodeClipRegion(comfyPage, [node.id])
    await expect(comfyPage.page).toHaveScreenshot('slider_widget_dragged.png', {
      clip
    })

    await expect
      .poll(() => comfyPage.page.evaluate(() => window.widgetValue))
      .toBeDefined()
  })
})

test.describe('Number widget', { tag: ['@screenshot', '@widget'] }, () => {
  test('Can drag adjust value', async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('widgets/seed_widget')

    const node = (await comfyPage.nodeOps.getFirstNodeRef())!
    const widget = await node.getWidget(0)
    await comfyPage.page.evaluate(() => {
      window.widgetValue = undefined
      const widget = window.app!.graph!.nodes[0].widgets![0]
      widget.callback = (value: number) => {
        window.widgetValue = value
      }
    })
    await widget.dragHorizontal(50)
    const clip = await getNodeClipRegion(comfyPage, [node.id])
    await expect(comfyPage.page).toHaveScreenshot('seed_widget_dragged.png', {
      clip
    })

    await expect
      .poll(() => comfyPage.page.evaluate(() => window.widgetValue))
      .toBeDefined()
  })
})

test.describe(
  'Dynamic widget manipulation',
  { tag: ['@screenshot', '@widget'] },
  () => {
    test('Auto expand node when widget is added dynamically', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')
      const node = (await comfyPage.nodeOps.getFirstNodeRef())!
      const initialSize = await node.getSize()

      await comfyPage.page.evaluate(() => {
        window.app!.graph!.nodes[0].addWidget('number', 'new_widget', 10, null)
        window.app!.graph!.setDirtyCanvas(true, true)
      })

      await expect
        .poll(async () => (await node.getSize()).height)
        .toBeGreaterThan(initialSize.height)

      const clip = await getNodeClipRegion(comfyPage, [node.id])
      await expect(comfyPage.page).toHaveScreenshot(
        'ksampler_widget_added.png',
        { clip }
      )
    })
  }
)

test.describe('Image widget', { tag: ['@screenshot', '@widget'] }, () => {
  test('Can load image', async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('widgets/load_image_widget')
    const nodes = await comfyPage.nodeOps.getNodeRefsByType('LoadImage')
    const clip = await getNodeClipRegion(comfyPage, [nodes[0].id])
    await expect(comfyPage.page).toHaveScreenshot('load_image_widget.png', {
      maxDiffPixels: 50,
      clip
    })
  })

  test('Can drag and drop image', async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('widgets/load_image_widget')

    // Get position of the load image node
    const nodes = await comfyPage.nodeOps.getNodeRefsByType('LoadImage')
    const loadImageNode = nodes[0]
    const { x, y } = await loadImageNode.getPosition()

    // Drag and drop image file onto the load image node
    await comfyPage.dragDrop.dragAndDropFile('image32x32.webp', {
      dropPosition: { x, y }
    })

    // Expect the image preview to change automatically
    const clip = await getNodeClipRegion(comfyPage, [loadImageNode.id])
    await expect(comfyPage.page).toHaveScreenshot(
      'image_preview_drag_and_dropped.png',
      { clip }
    )

    // Expect the filename combo value to be updated
    const fileComboWidget = await loadImageNode.getWidget(0)
    await expect.poll(() => fileComboWidget.getValue()).toBe('image32x32.webp')
  })

  test('Can change image by changing the filename combo value', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('widgets/load_image_widget')
    const nodes = await comfyPage.nodeOps.getNodeRefsByType('LoadImage')
    const loadImageNode = nodes[0]

    // Click the combo widget used to select the image filename
    const fileComboWidget = await loadImageNode.getWidget(0)
    await fileComboWidget.click()

    // Select a new image filename value from the combo context menu
    const comboEntry = comfyPage.page.getByRole('menuitem', {
      name: 'image32x32.webp'
    })
    const imageLoaded = comfyPage.page.waitForResponse(
      (resp) =>
        resp.url().includes('/view') &&
        resp.url().includes('image32x32.webp') &&
        resp.request().method() === 'GET' &&
        resp.status() === 200
    )
    await comboEntry.click()

    // Wait for the image to load from the server
    await imageLoaded

    // Wait for the image to decode and appear on the node
    await expect
      .poll(
        () =>
          comfyPage.page.evaluate((nodeId) => {
            const node = window.app!.graph!.getNodeById(nodeId)
            const img = node?.imgs?.[0]
            return (
              !!img &&
              img.complete &&
              img.naturalWidth > 0 &&
              img.src.includes('image32x32.webp')
            )
          }, loadImageNode.id),
        { timeout: 10_000 }
      )
      .toBe(true)
    await comfyPage.nextFrame()

    // Expect the image preview to change automatically
    const clip = await getNodeClipRegion(comfyPage, [loadImageNode.id])
    await expect(comfyPage.page).toHaveScreenshot(
      'image_preview_changed_by_combo_value.png',
      { maxDiffPixels: 50, clip }
    )

    // Expect the filename combo value to be updated
    await expect.poll(() => fileComboWidget.getValue()).toBe('image32x32.webp')
  })

  test('Displays buttons when viewing single image of batch', async ({
    comfyPage
  }) => {
    const [x, y] = await comfyPage.page.evaluate(() => {
      const src =
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='768' height='512' viewBox='0 0 1 1'%3E%3Crect width='1' height='1' stroke='black'/%3E%3C/svg%3E"
      const image1 = new Image()
      image1.src = src
      const image2 = new Image()
      image2.src = src
      const targetNode = graph!.nodes[6]
      targetNode.imgs = [image1, image2]
      targetNode.imageIndex = 1
      app!.canvas.setDirty(true)

      const x = targetNode.pos[0] + targetNode.size[0] - 41
      const y = targetNode.pos[1] + targetNode.widgets!.at(-1)!.last_y! + 30
      return app!.canvasPosToClientPos([x, y])
    })

    const clip = { x, y, width: 35, height: 35 }
    await expect(comfyPage.page).toHaveScreenshot(
      'image_preview_close_button.png',
      { clip }
    )
  })
})

test.describe(
  'Animated image widget',
  { tag: ['@screenshot', '@widget'] },
  () => {
    test('Can drag-and-drop animated webp image', async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('widgets/load_animated_webp')

      // Get position of the load animated webp node
      const nodes = await comfyPage.nodeOps.getNodeRefsByType(
        'DevToolsLoadAnimatedImageTest'
      )
      const loadAnimatedWebpNode = nodes[0]
      const { x, y } = await loadAnimatedWebpNode.getPosition()

      // Drag and drop image file onto the load animated webp node
      await comfyPage.dragDrop.dragAndDropFile('animated_webp.webp', {
        dropPosition: { x, y },
        waitForUpload: true
      })

      // Expect the filename combo value to be updated
      const fileComboWidget = await loadAnimatedWebpNode.getWidget(0)
      await expect
        .poll(() => fileComboWidget.getValue())
        .toContain('animated_webp.webp')
    })

    test('Can preview saved animated webp image', async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('widgets/save_animated_webp')

      // Get position of the load animated webp node
      const loadNodes = await comfyPage.nodeOps.getNodeRefsByType(
        'DevToolsLoadAnimatedImageTest'
      )
      const loadAnimatedWebpNode = loadNodes[0]
      const { x, y } = await loadAnimatedWebpNode.getPosition()

      // Drag and drop image file onto the load animated webp node
      await comfyPage.dragDrop.dragAndDropFile('animated_webp.webp', {
        dropPosition: { x, y },
        waitForUpload: true
      })

      await expect
        .poll(
          () =>
            comfyPage.page.evaluate(
              (loadId) => window.app!.nodeOutputs[loadId]?.images?.length ?? 0,
              loadAnimatedWebpNode.id
            ),
          { timeout: 10_000 }
        )
        .toBeGreaterThan(0)

      // Get the SaveAnimatedWEBP node
      const saveNodes =
        await comfyPage.nodeOps.getNodeRefsByType('SaveAnimatedWEBP')
      const saveAnimatedWebpNode = saveNodes[0]
      if (!saveAnimatedWebpNode)
        throw new Error('SaveAnimatedWEBP node not found')

      // Simulate the graph executing
      await comfyPage.page.evaluate(
        ([loadId, saveId]) => {
          // Set the output of the SaveAnimatedWEBP node to equal the loader node's image
          window.app!.nodeOutputs[saveId] = window.app!.nodeOutputs[loadId]
          app!.canvas.setDirty(true)
        },
        [loadAnimatedWebpNode.id, saveAnimatedWebpNode.id]
      )

      await expect
        .poll(
          () =>
            comfyPage.page.evaluate(
              ([loadId, saveId]) => {
                const graph = window.app!.graph

                // Re-dirty the canvas so onDrawBackground fires again on the
                // next frame. Without this, the single setDirty(true) above
                // only triggers one paint; if the async image load inside
                // showPreview() hasn't completed by then, node.imgs stays
                // empty and no further paints re-check it.
                window.app!.canvas.setDirty(true, true)

                return [loadId, saveId].map(
                  (nodeId) => (graph.getNodeById(nodeId)?.imgs?.length ?? 0) > 0
                )
              },
              [loadAnimatedWebpNode.id, saveAnimatedWebpNode.id]
            ),
          { timeout: 10_000 }
        )
        .toEqual([true, true])
    })
  }
)

test.describe('Load audio widget', { tag: ['@screenshot', '@widget'] }, () => {
  test('Can load audio', async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('widgets/load_audio_widget')
    await expect(comfyPage.page.locator('.comfy-audio')).toBeVisible()
    const node = (await comfyPage.nodeOps.getFirstNodeRef())!
    const clip = await getNodeClipRegion(comfyPage, [node.id])
    await expect(comfyPage.page).toHaveScreenshot('load_audio_widget.png', {
      clip
    })
  })
})

test.describe('Unserialized widgets', { tag: '@widget' }, () => {
  test('Unserialized widgets values do not mark graph as modified', async ({
    comfyPage
  }) => {
    // Add workflow w/ LoadImage node, which contains file upload and image preview widgets (not serialized)
    await comfyPage.workflow.loadWorkflow('widgets/load_image_widget')

    // Move mouse and click to trigger the `graphEqual` check in `changeTracker.ts`
    await comfyPage.page.mouse.move(10, 10)
    await comfyPage.page.mouse.click(10, 10)

    // Expect the graph to not be modified
    await expect
      .poll(() => comfyPage.workflow.isCurrentWorkflowModified())
      .toBe(false)
  })
})
