import { expect } from '@playwright/test'

import { comfyPageFixture } from '../fixtures/ComfyPage'

const test = comfyPageFixture

const BLUE_COLOR = 'rgb(51, 51, 85)'
const RED_COLOR = 'rgb(85, 51, 51)'

test.describe('Selection Toolbox', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.Canvas.SelectionToolbox', true)
  })

  test('shows selection toolbox', async ({ comfyPage }) => {
    // By default, selection toolbox should be enabled
    expect(
      await comfyPage.page.locator('.selection-overlay-container').isVisible()
    ).toBe(false)

    // Select multiple nodes
    await comfyPage.selectNodes(['KSampler', 'CLIP Text Encode (Prompt)'])

    // Selection toolbox should be visible with multiple nodes selected
    await expect(
      comfyPage.page.locator('.selection-overlay-container')
    ).toBeVisible()
    await expect(
      comfyPage.page.locator('.selection-overlay-container.show-border')
    ).toBeVisible()
  })

  test('shows at correct position when node is pasted', async ({
    comfyPage
  }) => {
    await comfyPage.loadWorkflow('single_ksampler')
    await comfyPage.selectNodes(['KSampler'])
    await comfyPage.ctrlC()
    await comfyPage.page.mouse.move(100, 100)
    await comfyPage.ctrlV()

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
  })

  test('hide when select and drag happen at the same time', async ({
    comfyPage
  }) => {
    await comfyPage.loadWorkflow('single_ksampler')
    const node = (await comfyPage.getNodeRefsByTitle('KSampler'))[0]
    const nodePos = await node.getPosition()

    // Drag on the title of the node
    await comfyPage.page.mouse.move(nodePos.x + 100, nodePos.y - 15)
    await comfyPage.page.mouse.down()
    await comfyPage.page.mouse.move(nodePos.x + 200, nodePos.y + 200)
    await comfyPage.nextFrame()
    await expect(
      comfyPage.page.locator('.selection-overlay-container')
    ).not.toBeVisible()
  })

  test('shows border only with multiple selections', async ({ comfyPage }) => {
    // Select single node
    await comfyPage.selectNodes(['KSampler'])

    // Selection overlay should be visible but without border
    await expect(
      comfyPage.page.locator('.selection-overlay-container')
    ).toBeVisible()
    await expect(
      comfyPage.page.locator('.selection-overlay-container.show-border')
    ).not.toBeVisible()

    // Select multiple nodes
    await comfyPage.selectNodes(['KSampler', 'CLIP Text Encode (Prompt)'])

    // Selection overlay should show border with multiple selections
    await expect(
      comfyPage.page.locator('.selection-overlay-container.show-border')
    ).toBeVisible()

    // Deselect to single node
    await comfyPage.selectNodes(['CLIP Text Encode (Prompt)'])

    // Border should be hidden again
    await expect(
      comfyPage.page.locator('.selection-overlay-container.show-border')
    ).not.toBeVisible()
  })

  test('displays bypass button in toolbox when nodes are selected', async ({
    comfyPage
  }) => {
    // A group + a KSampler node
    await comfyPage.loadWorkflow('single_group')

    // Select group + node should show bypass button
    await comfyPage.page.focus('canvas')
    await comfyPage.page.keyboard.press('Control+A')
    await expect(
      comfyPage.page.locator(
        '.selection-toolbox *[data-testid="bypass-button"]'
      )
    ).toBeVisible()

    // Deselect node (Only group is selected) should hide bypass button
    await comfyPage.selectNodes(['KSampler'])
    await expect(
      comfyPage.page.locator(
        '.selection-toolbox *[data-testid="bypass-button"]'
      )
    ).not.toBeVisible()
  })

  test.describe('Color Picker', () => {
    test('displays color picker button and allows color selection', async ({
      comfyPage
    }) => {
      // Select a node
      await comfyPage.selectNodes(['KSampler'])

      // Color picker button should be visible
      const colorPickerButton = comfyPage.page.locator(
        '.selection-toolbox .pi-circle-fill'
      )
      await expect(colorPickerButton).toBeVisible()

      // Click color picker button
      await colorPickerButton.click()

      // Color picker dropdown should be visible
      const colorPickerDropdown = comfyPage.page.locator(
        '.color-picker-container'
      )
      await expect(colorPickerDropdown).toBeVisible()

      // Select a color (e.g., blue)
      const blueColorOption = colorPickerDropdown.locator(
        'i[data-testid="blue"]'
      )
      await blueColorOption.click()

      // Dropdown should close after selection
      await expect(colorPickerDropdown).not.toBeVisible()

      // Node should have the selected color class/style
      // Note: Exact verification method depends on how color is applied to nodes
      const selectedNode = (await comfyPage.getNodeRefsByTitle('KSampler'))[0]
      expect(selectedNode.getProperty('color')).not.toBeNull()
    })

    test('color picker shows current color of selected nodes', async ({
      comfyPage
    }) => {
      // Select multiple nodes
      await comfyPage.selectNodes(['KSampler', 'CLIP Text Encode (Prompt)'])

      const colorPickerButton = comfyPage.page.locator(
        '.selection-toolbox .pi-circle-fill'
      )

      // Initially should show default color
      await expect(colorPickerButton).not.toHaveAttribute('color')

      // Click color picker and select a color
      await colorPickerButton.click()
      const redColorOption = comfyPage.page.locator(
        '.color-picker-container i[data-testid="red"]'
      )
      await redColorOption.click()

      // Button should now show the selected color
      await expect(colorPickerButton).toHaveCSS('color', RED_COLOR)
    })

    test('color picker shows mixed state for differently colored selections', async ({
      comfyPage
    }) => {
      // Select first node and color it
      await comfyPage.selectNodes(['KSampler'])
      await comfyPage.page.locator('.selection-toolbox .pi-circle-fill').click()
      await comfyPage.page
        .locator('.color-picker-container i[data-testid="blue"]')
        .click()
      await comfyPage.selectNodes(['KSampler'])

      // Select second node and color it differently
      await comfyPage.selectNodes(['CLIP Text Encode (Prompt)'])
      await comfyPage.page.locator('.selection-toolbox .pi-circle-fill').click()
      await comfyPage.page
        .locator('.color-picker-container i[data-testid="red"]')
        .click()

      // Select both nodes
      await comfyPage.selectNodes(['KSampler', 'CLIP Text Encode (Prompt)'])

      // Color picker should show null/mixed state
      const colorPickerButton = comfyPage.page.locator(
        '.selection-toolbox .pi-circle-fill'
      )
      await expect(colorPickerButton).not.toHaveAttribute('color')
    })

    test('color picker shows correct color when selecting pre-colored node', async ({
      comfyPage
    }) => {
      // First color a node
      await comfyPage.selectNodes(['KSampler'])
      await comfyPage.page.locator('.selection-toolbox .pi-circle-fill').click()
      await comfyPage.page
        .locator('.color-picker-container i[data-testid="blue"]')
        .click()

      // Clear selection
      await comfyPage.selectNodes(['KSampler'])

      // Re-select the node
      await comfyPage.selectNodes(['KSampler'])

      // Color picker button should show the correct color
      const colorPickerButton = comfyPage.page.locator(
        '.selection-toolbox .pi-circle-fill'
      )
      await expect(colorPickerButton).toHaveCSS('color', BLUE_COLOR)
    })

    test('colorization via color picker can be undone', async ({
      comfyPage
    }) => {
      // Select a node and color it
      await comfyPage.selectNodes(['KSampler'])
      await comfyPage.page.locator('.selection-toolbox .pi-circle-fill').click()
      await comfyPage.page
        .locator('.color-picker-container i[data-testid="blue"]')
        .click()

      // Undo the colorization
      await comfyPage.page.keyboard.press('Control+Z')
      await comfyPage.nextFrame()

      // Node should be uncolored again
      const selectedNode = (await comfyPage.getNodeRefsByTitle('KSampler'))[0]
      expect(await selectedNode.getProperty('color')).toBeUndefined()
    })
  })
})
