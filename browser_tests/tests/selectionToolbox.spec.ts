import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import {
  expectRegionScreenshot,
  screenshotRegion
} from '@e2e/fixtures/utils/screenshotRegion'

const test = comfyPageFixture

const BLUE_COLOR = 'rgb(51, 51, 85)'
const RED_COLOR = 'rgb(85, 51, 51)'

async function selectionTargets(comfyPage: ComfyPage, nodeTitles: string[]) {
  const nodes = await Promise.all(
    nodeTitles.map((title) => comfyPage.nodeOps.getNodeRefsByTitle(title))
  )
  return [...nodes.flat(), comfyPage.selectionToolbox]
}

const getColorPickerButton = (comfyPage: ComfyPage) =>
  comfyPage.selectionToolbox.getByRole('button', { name: 'Color', exact: true })

const getColorPickerCurrentColor = (comfyPage: { page: Page }) =>
  comfyPage.page.getByTestId(TestIds.selectionToolbox.colorPickerCurrentColor)

const getColorPickerGroup = (comfyPage: { page: Page }) =>
  comfyPage.page.getByRole('group').filter({
    has: comfyPage.page.getByTestId(TestIds.selectionToolbox.colorBlue)
  })

test.describe('Connections beside gap handles', () => {
  test.use({
    initialSettings: {
      'Comfy.UseNewMenu': 'Disabled',
      'Comfy.Canvas.SelectionToolbox': true
    }
  })

  for (const renderer of ['classic', 'vue'] as const) {
    test(
      `connects slots beside a narrow gap in ${renderer}`,
      { tag: renderer === 'vue' ? ['@canvas', '@vue-nodes'] : ['@canvas'] },
      async ({ comfyPage, comfyMouse }) => {
        const { page } = comfyPage
        await comfyPage.workflow.loadWorkflow('default', {
          nodes: { 8: { pos: [180, 100] }, 9: { pos: [420, 100] } }
        })
        const from = await comfyPage.nodeOps.getNodeRefByTitle('VAE Decode')
        const to = await comfyPage.nodeOps.getNodeRefByTitle('Save Image')
        const output = await from.getOutput(0)
        const input = await to.getInput(0)
        await input.removeLinks()
        await comfyPage.nodeOps.selectNodes(['VAE Decode', 'Save Image'])
        await page.getByRole('button', { name: 'Tidy up', exact: true }).click()
        const slider = page.getByRole('slider', { name: 'Gap between nodes' })
        await slider.press('Home')
        const handle = page.getByRole('spinbutton', {
          name: 'Gap between nodes'
        })
        await handle.press('Shift+ArrowRight')
        await expect(handle).toHaveAttribute('aria-valuenow', '10')
        const bounds = await handle.boundingBox()
        if (!bounds) throw new Error('Gap handle is not visible')
        await handle.hover()
        await comfyMouse.drag({
          x: bounds.x + bounds.width / 2 + 25,
          y: bounds.y + bounds.height / 2
        })
        await expect(handle).not.toHaveAttribute('aria-valuenow', '10')
        await page.keyboard.press('Escape')
        await comfyMouse.drop()
        await expect(handle).toHaveAttribute('aria-valuenow', '10')
        await handle.press('Shift+ArrowRight')
        await expect(handle).toHaveAttribute('aria-valuenow', '20')

        if (renderer === 'vue') {
          const outputDot = comfyPage.vueNodes.getOutputSlotConnectionDot(
            '8',
            0
          )
          const inputDot = comfyPage.vueNodes.getInputSlotConnectionDot('9', 0)
          await outputDot.dragTo(inputDot, { timeout: 5000 })
        } else {
          await comfyMouse.dragAndDrop(
            await output.getPosition(),
            await input.getPosition()
          )
        }

        await input.expectLinkCount(1)
        await output.expectLinkCount(1)
      }
    )
  }
})

test.describe('Selection Toolbox', { tag: ['@screenshot', '@ui'] }, () => {
  test.use({
    initialSettings: {
      'Comfy.UseNewMenu': 'Disabled',
      'Comfy.Canvas.SelectionToolbox': true
    }
  })

  test('moves enclosed reroutes with tidy and restores them on cancel and Undo', async ({
    comfyPage,
    comfyMouse
  }) => {
    const { page } = comfyPage
    await comfyPage.workflow.loadWorkflow('reroute/native_reroute', {
      nodes: { 4: { pos: [100, 200] }, 19: { pos: [610, 200] } }
    })
    const positions = () =>
      page.evaluate(() =>
        [...window.app!.graph.reroutes.values()]
          .sort((a, b) => a.id - b.id)
          .map(({ pos }) => [...pos])
      )
    const before = await positions()
    expect(before).toHaveLength(2)
    await comfyPage.nodeOps.selectNodes(['Load Checkpoint', 'VAE Decode'])
    await page.getByRole('button', { name: 'Tidy up', exact: true }).click()
    const handle = page.getByRole('spinbutton', { name: 'Gap between nodes' })
    await expect(handle).toBeVisible()
    const tidied = await positions()
    expect(tidied[0]).toEqual(before[0])
    expect(tidied[1]).not.toEqual(before[1])

    const bounds = await handle.boundingBox()
    expect(bounds).not.toBeNull()
    await handle.hover()
    await comfyMouse.drag({
      x: bounds!.x + bounds!.width / 2 + 35,
      y: bounds!.y + bounds!.height / 2
    })
    await expect.poll(positions).not.toEqual(tidied)
    await page.keyboard.press('Escape')
    await comfyMouse.drop()
    await expect.poll(positions).toEqual(tidied)

    await comfyPage.keyboard.undo()
    await expect.poll(positions).toEqual(before)
  })

  test('releases a slider preview that returns to its starting gap', async ({
    comfyPage,
    comfyMouse
  }) => {
    const { page } = comfyPage
    await comfyPage.workflow.loadWorkflow('nodes/note_nodes')
    await comfyPage.canvasOps.pan({ x: 350, y: 250 })
    await comfyPage.nodeOps.selectNodes(['Note', 'Markdown Note'])
    const node = await comfyPage.nodeOps.getNodeRefByTitle('Markdown Note')
    const position = async () =>
      Array.from(await node.getProperty<[number, number]>('pos'))
    await page.getByRole('button', { name: 'Tidy up', exact: true }).click()
    const slider = page.getByRole('slider', { name: 'Gap between nodes' })
    const handle = page.getByRole('spinbutton', { name: 'Gap between nodes' })
    await slider.press('Home')
    await expect(handle).toHaveAttribute('aria-valuenow', '0')
    const before = await position()

    const bounds = await slider.boundingBox()
    if (!bounds) throw new Error('Gap slider is not visible')
    const origin = {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2
    }
    await slider.hover()
    await comfyMouse.drag({ x: origin.x + 30, y: origin.y })
    await expect(handle).not.toHaveAttribute('aria-valuenow', '0')
    await comfyMouse.move({ x: origin.x - 10, y: origin.y })
    await expect(handle).toHaveAttribute('aria-valuenow', '0')
    await comfyMouse.drop()

    await slider.press('ArrowRight')
    await expect(handle).toHaveAttribute('aria-valuenow', '1')
    await comfyPage.keyboard.undo()
    await expect.poll(position).toEqual(before)
  })

  test('cancels gap previews and undoes a held nudge as one edit', async ({
    comfyPage
  }) => {
    const { page } = comfyPage
    await comfyPage.workflow.loadWorkflow('nodes/note_nodes')
    await comfyPage.canvasOps.pan({ x: 350, y: 250 })
    await comfyPage.nodeOps.selectNodes(['Note', 'Markdown Note'])
    const node = await comfyPage.nodeOps.getNodeRefByTitle('Markdown Note')
    const position = async () =>
      Array.from(await node.getProperty<[number, number]>('pos'))
    const handle = page.getByRole('spinbutton', { name: 'Gap between nodes' })

    await test.step('open the slider and gap handles', async () => {
      await page.getByRole('button', { name: 'Tidy up', exact: true }).click()
      await expect(
        page.getByRole('slider', { name: 'Gap between nodes' })
      ).toBeVisible()
      await expect(handle).toBeVisible()
    })

    const before = await position()

    await test.step('cancel after a modifier key cannot leave moved nodes', async () => {
      const point = await handle.evaluate((element) => {
        const bounds = element.getBoundingClientRect()
        return {
          x: bounds.x + bounds.width / 2,
          y: bounds.y + bounds.height / 2
        }
      })
      await handle.hover()
      await page.mouse.down()
      await page.mouse.move(point.x, point.y + 25, { steps: 5 })
      await expect.poll(position).not.toEqual(before)
      await page.keyboard.press('Shift')
      await comfyPage.nextFrame()
      await expect.poll(position).not.toEqual(before)
      await page.keyboard.press('Escape')
      await page.mouse.up()
      await expect.poll(position).toEqual(before)
    })

    await test.step('undo during a drag reverts the last committed edit', async () => {
      await handle.focus()
      await page.keyboard.down('ArrowUp')
      await comfyPage.nextFrame()
      await page.keyboard.down('ArrowUp')
      await page.keyboard.down('ArrowUp')
      await page.keyboard.up('ArrowUp')
      const after = [before[0], before[1] + 3]
      await expect.poll(position).toEqual(after)

      await handle.hover()
      await page.mouse.down()
      const bounds = await handle.boundingBox()
      if (!bounds) throw new Error('Gap handle is not visible')
      await page.mouse.move(
        bounds.x + bounds.width / 2,
        bounds.y + bounds.height / 2 + 25,
        { steps: 5 }
      )
      await expect.poll(position).not.toEqual(after)
      await comfyPage.keyboard.undo()
      await page.mouse.up()
      await expect.poll(position).toEqual(before)
      await comfyPage.keyboard.redo()
      await expect.poll(position).toEqual(after)
    })

    await test.step('Escape closes the popover after an empty redo cancels the drag', async () => {
      await comfyPage.nodeOps.selectNodes(['Note', 'Markdown Note'])
      await page.getByRole('button', { name: 'Tidy up', exact: true }).click()
      await handle.hover()
      const beforeDrag = await position()
      await page.mouse.down()
      const bounds = await handle.boundingBox()
      if (!bounds) throw new Error('Gap handle is not visible')
      await page.mouse.move(
        bounds.x + bounds.width / 2,
        bounds.y + bounds.height / 2 + 25,
        { steps: 5 }
      )
      await expect.poll(position).not.toEqual(beforeDrag)
      await comfyPage.keyboard.redo()
      await expect.poll(position).toEqual(beforeDrag)
      await page.keyboard.press('Escape')
      await expect(
        page.getByRole('slider', { name: 'Gap between nodes' })
      ).toBeHidden()
      await page.mouse.up()
    })
  })

  test('shows selection toolbox', async ({ comfyPage }) => {
    const selectedTitles = ['KSampler', 'CLIP Text Encode (Prompt)']
    await expect(comfyPage.selectionToolbox).toBeHidden()

    await comfyPage.nodeOps.selectNodes(selectedTitles)

    await expect(comfyPage.selectionToolbox).toBeVisible()
    await expectRegionScreenshot(
      comfyPage.page,
      await selectionTargets(comfyPage, selectedTitles),
      'selection-toolbox-multiple-nodes-border.png',
      { maxDiffPixels: 100 }
    )
  })

  test('shows at correct position when node is pasted', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')
    await comfyPage.nodeOps.selectNodes(['KSampler'])
    await comfyPage.clipboard.copy()
    await comfyPage.page.mouse.move(100, 100)
    await comfyPage.clipboard.paste()

    const toolboxContainer = comfyPage.selectionToolbox
    await expect(toolboxContainer).toBeVisible()

    // Verify toolbox is positioned (canvas-based positioning has different coordinates)
    await expect
      .poll(async () => await toolboxContainer.boundingBox())
      .not.toBeNull()
    // Canvas-based positioning can vary, just verify toolbox appears in reasonable bounds
    await expect
      .poll(async () => (await toolboxContainer.boundingBox())?.x)
      .toBeGreaterThan(-200) // Not too far off-screen left
    await expect
      .poll(async () => (await toolboxContainer.boundingBox())?.x)
      .toBeLessThan(1000) // Not too far off-screen right
    await expect
      .poll(async () => (await toolboxContainer.boundingBox())?.y)
      .toBeGreaterThan(-100) // Not too far off-screen top
  })

  test('hide when select and drag happen at the same time', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')
    const node = (await comfyPage.nodeOps.getNodeRefsByTitle('KSampler'))[0]
    const nodePos = await node.getPosition()

    // Drag on the title of the node
    await comfyPage.page.mouse.move(nodePos.x + 100, nodePos.y - 15)
    await comfyPage.page.mouse.down()
    await comfyPage.page.mouse.move(nodePos.x + 200, nodePos.y + 200)
    await comfyPage.nextFrame()
    await expect(comfyPage.selectionToolbox).toBeHidden()
  })

  test('shows border only with multiple selections', async ({ comfyPage }) => {
    await comfyPage.nodeOps.selectNodes(['KSampler'])

    await expect(comfyPage.selectionToolbox).toBeVisible()
    const region = await screenshotRegion(
      comfyPage.page,
      await selectionTargets(comfyPage, [
        'KSampler',
        'CLIP Text Encode (Prompt)'
      ])
    )
    await region.expectScreenshot('selection-toolbox-single-node-no-border.png')

    await comfyPage.nodeOps.selectNodes([
      'KSampler',
      'CLIP Text Encode (Prompt)'
    ])

    await region.expectScreenshot(
      'selection-toolbox-multiple-selections-border.png'
    )

    await comfyPage.nodeOps.selectNodes(['CLIP Text Encode (Prompt)'])

    await region.expectScreenshot(
      'selection-toolbox-single-selection-no-border.png'
    )
  })

  test('displays bypass button in toolbox when nodes are selected', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('groups/single_group')
    const bypass = comfyPage.selectionToolbox.getByRole('button', {
      name: 'Bypass/Unbypass Selected Nodes',
      exact: true
    })

    await comfyPage.canvas.focus()
    await comfyPage.nodeOps.selectNodes(['KSampler'])
    await expect(bypass).toBeVisible()
    await comfyPage.keyboard.delete()

    await comfyPage.keyboard.selectAll()
    await expect(comfyPage.selectionToolbox).toBeVisible()
    await expect(bypass).toBeHidden()
  })

  test.describe('Color Picker', () => {
    test('displays color picker button and allows color selection', async ({
      comfyPage
    }) => {
      // Select a node
      await comfyPage.nodeOps.selectNodes(['KSampler'])

      // Color picker button should be visible
      const colorPickerButton = getColorPickerButton(comfyPage)
      await expect(colorPickerButton).toBeVisible()

      // Click color picker button
      await colorPickerButton.click()

      // Color picker dropdown should be visible
      const colorPickerGroup = getColorPickerGroup(comfyPage)
      await expect(colorPickerGroup).toBeVisible()

      // Select a color (e.g., blue)
      const blueColorOption = colorPickerGroup.getByTestId(
        TestIds.selectionToolbox.colorBlue
      )
      await blueColorOption.click()

      // Dropdown should close after selection
      await expect(colorPickerGroup).toBeHidden()

      // Node should have the selected color class/style
      // Note: Exact verification method depends on how color is applied to nodes
      const selectedNode = (
        await comfyPage.nodeOps.getNodeRefsByTitle('KSampler')
      )[0]
      await expect.poll(() => selectedNode.getProperty('color')).toBeDefined()
    })

    test('color picker shows current color of selected nodes', async ({
      comfyPage
    }) => {
      await comfyPage.nodeOps.selectNodes([
        'KSampler',
        'CLIP Text Encode (Prompt)'
      ])

      const colorPickerButton = getColorPickerButton(comfyPage)
      const colorPickerCurrentColor = getColorPickerCurrentColor(comfyPage)

      await expect(colorPickerButton).not.toHaveAttribute('color')
      await expect(colorPickerCurrentColor).toHaveCSS('width', '16px')
      await expect(colorPickerCurrentColor).toHaveCSS('height', '16px')

      await colorPickerButton.click()
      const redColorOption = getColorPickerGroup(comfyPage).getByTestId(
        TestIds.selectionToolbox.colorRed
      )
      await redColorOption.click()

      await expect(colorPickerCurrentColor).toHaveCSS('color', RED_COLOR)
    })

    test('color picker shows mixed state for differently colored selections', async ({
      comfyPage
    }) => {
      // Select first node and color it
      await comfyPage.nodeOps.selectNodes(['KSampler'])
      await getColorPickerButton(comfyPage).click()
      await getColorPickerGroup(comfyPage)
        .getByTestId(TestIds.selectionToolbox.colorBlue)
        .click()
      await comfyPage.nodeOps.selectNodes(['KSampler'])

      // Select second node and color it differently
      await comfyPage.nodeOps.selectNodes(['CLIP Text Encode (Prompt)'])
      await getColorPickerButton(comfyPage).click()
      await getColorPickerGroup(comfyPage)
        .getByTestId(TestIds.selectionToolbox.colorRed)
        .click()

      // Select both nodes
      await comfyPage.nodeOps.selectNodes([
        'KSampler',
        'CLIP Text Encode (Prompt)'
      ])

      // Color picker should show null/mixed state
      const colorPickerButton = getColorPickerButton(comfyPage)
      await expect(colorPickerButton).not.toHaveAttribute('color')
    })

    test('color picker shows correct color when selecting pre-colored node', async ({
      comfyPage
    }) => {
      // First color a node
      await comfyPage.nodeOps.selectNodes(['KSampler'])
      await getColorPickerButton(comfyPage).click()
      await getColorPickerGroup(comfyPage)
        .getByTestId(TestIds.selectionToolbox.colorBlue)
        .click()

      // Clear selection
      await comfyPage.nodeOps.selectNodes(['KSampler'])

      // Re-select the node
      await comfyPage.nodeOps.selectNodes(['KSampler'])

      // Color picker button should show the correct color
      const colorPickerCurrentColor = getColorPickerCurrentColor(comfyPage)
      await expect(colorPickerCurrentColor).toHaveCSS('color', BLUE_COLOR)
    })

    test('colorization via color picker can be undone', async ({
      comfyPage
    }) => {
      // Select a node and color it
      await comfyPage.nodeOps.selectNodes(['KSampler'])
      await getColorPickerButton(comfyPage).click()
      await getColorPickerGroup(comfyPage)
        .getByTestId(TestIds.selectionToolbox.colorBlue)
        .click()

      // Undo the colorization
      await comfyPage.keyboard.press('Control+Z')

      // Node should be uncolored again
      const selectedNode = (
        await comfyPage.nodeOps.getNodeRefsByTitle('KSampler')
      )[0]
      await expect.poll(() => selectedNode.getProperty('color')).toBeUndefined()
    })
  })
})
