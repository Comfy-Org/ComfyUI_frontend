import { expect } from '@playwright/test'

import { comfyPageFixture } from '../fixtures/ComfyPage'
import { PerformanceMonitor } from '../helpers/performanceMonitor'

const test = comfyPageFixture

const BLUE_COLOR = 'rgb(51, 51, 85)'
const RED_COLOR = 'rgb(85, 51, 51)'

test.describe('Selection Toolbox', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.Canvas.SelectionToolbox', true)
  })

  test('@perf shows selection toolbox', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'show-selection-toolbox'

    await perfMonitor.startMonitoring(testName)

    // By default, selection toolbox should be enabled
    expect(
      await comfyPage.page.locator('.selection-overlay-container').isVisible()
    ).toBe(false)

    // Select multiple nodes
    await perfMonitor.measureOperation('select-multiple-nodes', async () => {
      await comfyPage.selectNodes(['KSampler', 'CLIP Text Encode (Prompt)'])
    })

    // Selection toolbox should be visible with multiple nodes selected
    await expect(
      comfyPage.page.locator('.selection-overlay-container')
    ).toBeVisible()
    await expect(
      comfyPage.page.locator('.selection-overlay-container.show-border')
    ).toBeVisible()

    await perfMonitor.finishMonitoring(testName)
  })

  test('@perf shows at correct position when node is pasted', async ({
    comfyPage
  }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'node-paste-position'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('load-workflow', async () => {
      await comfyPage.loadWorkflow('single_ksampler')
    })

    await perfMonitor.measureOperation('select-node', async () => {
      await comfyPage.selectNodes(['KSampler'])
    })

    await perfMonitor.measureOperation('copy-node', async () => {
      await comfyPage.ctrlC()
    })

    await perfMonitor.measureOperation('position-mouse', async () => {
      await comfyPage.page.mouse.move(100, 100)
    })

    await perfMonitor.measureOperation('paste-node', async () => {
      await comfyPage.ctrlV()
    })

    const overlayContainer = comfyPage.page.locator(
      '.selection-overlay-container'
    )
    await expect(overlayContainer).toBeVisible()

    // Verify the absolute position
    const boundingBox = await overlayContainer.boundingBox()
    expect(boundingBox).not.toBeNull()
    // 10px offset for the pasted node
    expect(Math.round(boundingBox!.x)).toBeCloseTo(90, -1) // Allow ~10px tolerance
    // 30px offset of node title height
    expect(Math.round(boundingBox!.y)).toBeCloseTo(60, -1)

    await perfMonitor.finishMonitoring(testName)
  })

  // Skip because fails with vue widget nodes (reason not investigated)
  test.skip('@perf hide when select and drag happen at the same time', async ({
    comfyPage
  }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'hide-toolbox-during-drag'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('load-workflow', async () => {
      await comfyPage.loadWorkflow('single_ksampler')
    })

    let node: any
    let nodePos: any
    await perfMonitor.measureOperation('get-node-position', async () => {
      node = (await comfyPage.getNodeRefsByTitle('KSampler'))[0]
      nodePos = await node.getPosition()
    })

    // Drag on the title of the node
    await perfMonitor.measureOperation('start-drag', async () => {
      await comfyPage.page.mouse.move(nodePos.x + 100, nodePos.y - 15)
      await comfyPage.page.mouse.down()
    })

    await perfMonitor.measureOperation('drag-to-position', async () => {
      await comfyPage.page.mouse.move(nodePos.x + 200, nodePos.y + 200)
    })

    await comfyPage.nextFrame()
    await expect(
      comfyPage.page.locator('.selection-overlay-container')
    ).not.toBeVisible()

    await perfMonitor.finishMonitoring(testName)
  })

  test('@perf shows border only with multiple selections', async ({
    comfyPage
  }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'border-multiple-selections'

    await perfMonitor.startMonitoring(testName)

    // Select single node
    await perfMonitor.measureOperation('select-single-node', async () => {
      await comfyPage.selectNodes(['KSampler'])
    })

    // Selection overlay should be visible but without border
    await expect(
      comfyPage.page.locator('.selection-overlay-container')
    ).toBeVisible()
    await expect(
      comfyPage.page.locator('.selection-overlay-container.show-border')
    ).not.toBeVisible()

    // Select multiple nodes
    await perfMonitor.measureOperation('select-multiple-nodes', async () => {
      await comfyPage.selectNodes(['KSampler', 'CLIP Text Encode (Prompt)'])
    })

    // Selection overlay should show border with multiple selections
    await expect(
      comfyPage.page.locator('.selection-overlay-container.show-border')
    ).toBeVisible()

    // Deselect to single node
    await perfMonitor.measureOperation('deselect-to-single', async () => {
      await comfyPage.selectNodes(['CLIP Text Encode (Prompt)'])
    })

    // Border should be hidden again
    await expect(
      comfyPage.page.locator('.selection-overlay-container.show-border')
    ).not.toBeVisible()

    await perfMonitor.finishMonitoring(testName)
  })

  test('@perf displays bypass button in toolbox when nodes are selected', async ({
    comfyPage
  }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'bypass-button-display'

    await perfMonitor.startMonitoring(testName)

    // A group + a KSampler node
    await perfMonitor.measureOperation('load-workflow', async () => {
      await comfyPage.loadWorkflow('single_group')
    })

    // Select group + node should show bypass button
    await perfMonitor.measureOperation('select-all-nodes', async () => {
      await comfyPage.page.focus('canvas')
      await comfyPage.page.keyboard.press('Control+A')
    })

    await expect(
      comfyPage.page.locator(
        '.selection-toolbox *[data-testid="bypass-button"]'
      )
    ).toBeVisible()

    // Deselect node (Only group is selected) should hide bypass button
    await perfMonitor.measureOperation('select-single-node', async () => {
      await comfyPage.selectNodes(['KSampler'])
    })

    await expect(
      comfyPage.page.locator(
        '.selection-toolbox *[data-testid="bypass-button"]'
      )
    ).not.toBeVisible()

    await perfMonitor.finishMonitoring(testName)
  })

  test.describe('Color Picker', () => {
    test('@perf displays color picker button and allows color selection', async ({
      comfyPage
    }) => {
      const perfMonitor = new PerformanceMonitor(comfyPage.page)
      const testName = 'color-picker-selection'

      await perfMonitor.startMonitoring(testName)

      // Select a node
      await perfMonitor.measureOperation('select-node', async () => {
        await comfyPage.selectNodes(['KSampler'])
      })

      // Color picker button should be visible
      const colorPickerButton = comfyPage.page.locator(
        '.selection-toolbox .pi-circle-fill'
      )
      await expect(colorPickerButton).toBeVisible()

      // Click color picker button
      await perfMonitor.measureOperation('open-color-picker', async () => {
        await colorPickerButton.click()
      })

      // Color picker dropdown should be visible
      const colorPickerDropdown = comfyPage.page.locator(
        '.color-picker-container'
      )
      await expect(colorPickerDropdown).toBeVisible()

      // Select a color (e.g., blue)
      await perfMonitor.measureOperation('select-color', async () => {
        const blueColorOption = colorPickerDropdown.locator(
          'i[data-testid="blue"]'
        )
        await blueColorOption.click()
      })

      // Dropdown should close after selection
      await expect(colorPickerDropdown).not.toBeVisible()

      // Node should have the selected color class/style
      // Note: Exact verification method depends on how color is applied to nodes
      const selectedNode = (await comfyPage.getNodeRefsByTitle('KSampler'))[0]
      expect(selectedNode.getProperty('color')).not.toBeNull()

      await perfMonitor.finishMonitoring(testName)
    })

    test.skip('@perf color picker shows current color of selected nodes', async ({
      comfyPage
    }) => {
      const perfMonitor = new PerformanceMonitor(comfyPage.page)
      const testName = 'color-picker-current-color'

      await perfMonitor.startMonitoring(testName)

      // Select multiple nodes
      await perfMonitor.measureOperation('select-multiple-nodes', async () => {
        await comfyPage.selectNodes(['KSampler', 'CLIP Text Encode (Prompt)'])
      })

      const colorPickerButton = comfyPage.page.locator(
        '.selection-toolbox .pi-circle-fill'
      )

      // Initially should show default color
      await expect(colorPickerButton).not.toHaveAttribute('color')

      // Click color picker and select a color
      await perfMonitor.measureOperation('open-color-picker', async () => {
        await colorPickerButton.click()
      })

      await perfMonitor.measureOperation('select-red-color', async () => {
        const redColorOption = comfyPage.page.locator(
          '.color-picker-container i[data-testid="red"]'
        )
        await redColorOption.click()
      })

      // Button should now show the selected color
      await expect(colorPickerButton).toHaveCSS('color', RED_COLOR)

      await perfMonitor.finishMonitoring(testName)
    })

    test('@perf color picker shows mixed state for differently colored selections', async ({
      comfyPage
    }) => {
      const perfMonitor = new PerformanceMonitor(comfyPage.page)
      const testName = 'color-picker-mixed-state'

      await perfMonitor.startMonitoring(testName)

      // Select first node and color it
      await perfMonitor.measureOperation('color-first-node', async () => {
        await comfyPage.selectNodes(['KSampler'])
        await comfyPage.page
          .locator('.selection-toolbox .pi-circle-fill')
          .click()
        await comfyPage.page
          .locator('.color-picker-container i[data-testid="blue"]')
          .click()
        await comfyPage.selectNodes(['KSampler'])
      })

      // Select second node and color it differently
      await perfMonitor.measureOperation('color-second-node', async () => {
        await comfyPage.selectNodes(['CLIP Text Encode (Prompt)'])
        await comfyPage.page
          .locator('.selection-toolbox .pi-circle-fill')
          .click()
        await comfyPage.page
          .locator('.color-picker-container i[data-testid="red"]')
          .click()
      })

      // Select both nodes
      await perfMonitor.measureOperation('select-both-nodes', async () => {
        await comfyPage.selectNodes(['KSampler', 'CLIP Text Encode (Prompt)'])
      })

      // Color picker should show null/mixed state
      const colorPickerButton = comfyPage.page.locator(
        '.selection-toolbox .pi-circle-fill'
      )
      await expect(colorPickerButton).not.toHaveAttribute('color')

      await perfMonitor.finishMonitoring(testName)
    })

    test.skip('@perf color picker shows correct color when selecting pre-colored node', async ({
      comfyPage
    }) => {
      const perfMonitor = new PerformanceMonitor(comfyPage.page)
      const testName = 'color-picker-pre-colored'

      await perfMonitor.startMonitoring(testName)

      // First color a node
      await perfMonitor.measureOperation('color-node-blue', async () => {
        await comfyPage.selectNodes(['KSampler'])
        await comfyPage.page
          .locator('.selection-toolbox .pi-circle-fill')
          .click()
        await comfyPage.page
          .locator('.color-picker-container i[data-testid="blue"]')
          .click()
      })

      // Clear selection
      await perfMonitor.measureOperation('clear-selection', async () => {
        await comfyPage.selectNodes(['KSampler'])
      })

      // Re-select the node
      await perfMonitor.measureOperation('reselect-node', async () => {
        await comfyPage.selectNodes(['KSampler'])
      })

      // Color picker button should show the correct color
      const colorPickerButton = comfyPage.page.locator(
        '.selection-toolbox .pi-circle-fill'
      )
      await expect(colorPickerButton).toHaveCSS('color', BLUE_COLOR)

      await perfMonitor.finishMonitoring(testName)
    })

    test('@perf colorization via color picker can be undone', async ({
      comfyPage
    }) => {
      const perfMonitor = new PerformanceMonitor(comfyPage.page)
      const testName = 'color-picker-undo'

      await perfMonitor.startMonitoring(testName)

      // Select a node and color it
      await perfMonitor.measureOperation('color-node', async () => {
        await comfyPage.selectNodes(['KSampler'])
        await comfyPage.page
          .locator('.selection-toolbox .pi-circle-fill')
          .click()
        await comfyPage.page
          .locator('.color-picker-container i[data-testid="blue"]')
          .click()
      })

      // Undo the colorization
      await perfMonitor.measureOperation('undo-operation', async () => {
        await comfyPage.page.keyboard.press('Control+Z')
        await comfyPage.nextFrame()
      })

      // Node should be uncolored again
      const selectedNode = (await comfyPage.getNodeRefsByTitle('KSampler'))[0]
      expect(await selectedNode.getProperty('color')).toBeUndefined()

      await perfMonitor.finishMonitoring(testName)
    })
  })
})
