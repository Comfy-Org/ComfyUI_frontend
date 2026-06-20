import type { Locator } from '@playwright/test'

import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { intersection } from '@e2e/fixtures/utils/boundsUtils'

test.describe('Vue Combo Widget', { tag: ['@vue-nodes', '@widget'] }, () => {
  async function openSamplerDropdown(comfyPage: ComfyPage) {
    await comfyPage.workflow.loadWorkflow('vueNodes/linked-int-widget')

    const samplerCombo = comfyPage.vueNodes
      .getNodeByTitle('KSampler')
      .getByRole('combobox', { name: 'sampler_name', exact: true })

    await samplerCombo.click()

    const viewport = comfyPage.page.getByTestId(
      TestIds.widgets.selectDefaultViewport
    )
    await expect(viewport).toBeVisible()

    return viewport
  }

  async function pressDropdownScrollbar(
    comfyPage: ComfyPage,
    viewport: Locator
  ) {
    const { x, y } = await getScrollbarPressPoint(viewport)

    await comfyPage.page.mouse.move(x, y)
    await comfyPage.page.mouse.down()
    await expect(viewport).toBeVisible()
    await comfyPage.page.mouse.up()
  }

  async function getCanvasViewport(comfyPage: ComfyPage) {
    return comfyPage.page.evaluate(() => ({
      scale: window.app!.canvas.ds.scale,
      offset: [...window.app!.canvas.ds.offset]
    }))
  }

  async function getViewportBox(viewport: Locator) {
    await expect.poll(() => viewport.boundingBox()).not.toBeNull()

    const box = await viewport.boundingBox()
    if (!box) {
      throw new Error('Widget select viewport is not visible')
    }

    return box
  }

  async function getScrollbarPressPoint(viewport: Locator) {
    await expect
      .poll(() =>
        viewport.evaluate(
          (element) => element.scrollHeight > element.clientHeight
        )
      )
      .toBe(true)

    return viewport.evaluate((element) => {
      const viewportElement = element as HTMLElement
      const rect = viewportElement.getBoundingClientRect()
      const scrollbarWidth =
        viewportElement.offsetWidth - viewportElement.clientWidth
      const scrollbarInset = scrollbarWidth > 0 ? scrollbarWidth / 2 : 2

      return {
        x: rect.right - scrollbarInset,
        y: rect.top + Math.min(rect.height / 2, 20)
      }
    })
  }

  async function getMixedGraphSamplerCombos(comfyPage: ComfyPage) {
    await comfyPage.workflow.loadWorkflow('groups/mixed_graph_items')
    await comfyPage.vueNodes.waitForNodes(3)

    const nodes = comfyPage.vueNodes.getNodeByTitle('KSampler')
    await expect(nodes).toHaveCount(3)

    return {
      firstSamplerCombo: nodes
        .nth(0)
        .getByRole('combobox', { name: 'sampler_name', exact: true }),
      secondSamplerCombo: nodes
        .nth(2)
        .getByRole('combobox', { name: 'sampler_name', exact: true })
    }
  }

  async function getActiveWidgetSelectViewport(comfyPage: ComfyPage) {
    const viewport = comfyPage.page.getByTestId(
      TestIds.widgets.selectDefaultViewport
    )
    await expect(viewport).toBeVisible()
    return viewport
  }

  async function expectWheelScrollsDropdownWithoutMovingCanvas(
    comfyPage: ComfyPage,
    viewport: Locator
  ) {
    const canvasViewportBefore = await getCanvasViewport(comfyPage)
    await viewport.evaluate((el) => {
      el.scrollTop = 0
    })
    const scrollBefore = 0
    const box = await getViewportBox(viewport)

    await comfyPage.page.mouse.move(
      box.x + box.width / 2,
      box.y + Math.min(box.height / 2, 40)
    )
    await comfyPage.page.mouse.wheel(0, 120)

    await expect
      .poll(() => viewport.evaluate((el) => el.scrollTop))
      .toBeGreaterThan(scrollBefore)

    const canvasViewportAfter = await getCanvasViewport(comfyPage)
    expect(canvasViewportAfter).toEqual(canvasViewportBefore)
  }

  test('opens a dropdown that lists sampler options', async ({ comfyPage }) => {
    await openSamplerDropdown(comfyPage)

    // The option list should include at least a few known samplers
    await expect(
      comfyPage.page.getByRole('option', { name: 'euler', exact: true })
    ).toBeVisible()
    await expect(
      comfyPage.page.getByRole('option', { name: 'dpmpp_2m', exact: true })
    ).toBeVisible()
  })

  test('updates the combo value after a new option is selected', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('vueNodes/linked-int-widget')

    await comfyPage.vueNodes.selectComboOption(
      'KSampler',
      'sampler_name',
      'dpmpp_2m'
    )

    const samplerCombo = comfyPage.vueNodes
      .getNodeByTitle('KSampler')
      .getByRole('combobox', { name: 'sampler_name', exact: true })

    await expect(samplerCombo).toContainText('dpmpp_2m')
  })

  test('mouse wheel scrolls the dropdown list instead of zooming the canvas', async ({
    comfyPage
  }) => {
    const viewport = await openSamplerDropdown(comfyPage)

    await expectWheelScrollsDropdownWithoutMovingCanvas(comfyPage, viewport)
  })

  test('keeps the dropdown open when the scrollbar is pressed', async ({
    comfyPage
  }) => {
    const viewport = await openSamplerDropdown(comfyPage)

    await pressDropdownScrollbar(comfyPage, viewport)
    await expect(viewport).toBeVisible()
  })

  test('closes the dropdown when clicking outside', async ({ comfyPage }) => {
    const viewport = await openSamplerDropdown(comfyPage)

    await comfyPage.page.mouse.click(10, 10)

    await expect(viewport).toBeHidden()
  })

  test('keeps wheel scrolling captured after the scrollbar is pressed', async ({
    comfyPage
  }) => {
    const viewport = await openSamplerDropdown(comfyPage)

    await pressDropdownScrollbar(comfyPage, viewport)

    await expectWheelScrollsDropdownWithoutMovingCanvas(comfyPage, viewport)
  })

  test('closes the previous dropdown when another node widget opens', async ({
    comfyPage
  }) => {
    const { firstSamplerCombo, secondSamplerCombo } =
      await getMixedGraphSamplerCombos(comfyPage)

    await firstSamplerCombo.click()
    const viewport = await getActiveWidgetSelectViewport(comfyPage)

    await pressDropdownScrollbar(comfyPage, viewport)
    await expect(viewport).toBeVisible()

    await secondSamplerCombo.click()
    await expect(
      comfyPage.page.getByTestId(TestIds.widgets.selectDefaultViewport)
    ).toHaveCount(1)
    await expect(
      comfyPage.page.getByTestId(TestIds.widgets.selectDefaultViewport)
    ).toBeVisible()
  })

  test('preserves dropdown scroll capture when switching between node widgets', async ({
    comfyPage
  }) => {
    const { firstSamplerCombo, secondSamplerCombo } =
      await getMixedGraphSamplerCombos(comfyPage)

    await firstSamplerCombo.click()
    const viewport = await getActiveWidgetSelectViewport(comfyPage)

    await expectWheelScrollsDropdownWithoutMovingCanvas(comfyPage, viewport)

    await pressDropdownScrollbar(comfyPage, viewport)
    await expect(viewport).toBeVisible()

    await expectWheelScrollsDropdownWithoutMovingCanvas(comfyPage, viewport)

    await secondSamplerCombo.click()
    await expect(
      comfyPage.page.getByTestId(TestIds.widgets.selectDefaultViewport)
    ).toHaveCount(1)

    const secondViewport = await getActiveWidgetSelectViewport(comfyPage)

    await expectWheelScrollsDropdownWithoutMovingCanvas(
      comfyPage,
      secondViewport
    )

    await pressDropdownScrollbar(comfyPage, secondViewport)
    await expect(secondViewport).toBeVisible()

    await expectWheelScrollsDropdownWithoutMovingCanvas(
      comfyPage,
      secondViewport
    )
  })

  test('persists the selected combo value across a serialize and reload round-trip', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('vueNodes/linked-int-widget')

    await comfyPage.vueNodes.selectComboOption(
      'KSampler',
      'scheduler',
      'karras'
    )

    const serialized = await comfyPage.workflow.getExportedWorkflow()
    await comfyPage.workflow.loadGraphData(serialized)
    await comfyPage.vueNodes.waitForNodes()

    const [ksamplerNode] = await comfyPage.nodeOps.getNodeRefsByType('KSampler')
    if (!ksamplerNode) {
      throw new Error('KSampler node not found after reload')
    }

    const schedulerWidget = await ksamplerNode.getWidgetByName('scheduler')
    await expect.poll(() => schedulerWidget.getValue()).toBe('karras')

    const schedulerComboAfterReload = comfyPage.vueNodes
      .getNodeByTitle('KSampler')
      .getByRole('combobox', { name: 'scheduler', exact: true })
    await expect(schedulerComboAfterReload).toContainText('karras')
  })

  test('Dropdown displays over Selection Toolbox', async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.Canvas.SelectionToolbox', true)

    const nodeName = 'Resize Image/Mask'
    await comfyPage.searchBoxV2.addNode(nodeName, {
      position: { x: 200, y: 630 }
    })
    const node = await comfyPage.vueNodes.getFixtureByTitle(nodeName)
    await node.select()
    await expect(comfyPage.selectionToolbox).toBeVisible()

    const combo = comfyPage.vueNodes.getWidgetByName(nodeName, 'resize_type')
    await combo.click()
    const dropdown = comfyPage.page.getByTestId(
      TestIds.widgets.selectDefaultViewport
    )
    await expect(dropdown).toBeVisible()

    const bounds = (await intersection(dropdown, comfyPage.selectionToolbox))!
    expect(bounds, 'toolbox and dropdown overlap').toBeDefined()
    const cX = bounds.x + bounds.width / 2
    const cY = bounds.y + bounds.height / 2
    const dropdownBounds = (await dropdown.boundingBox())!
    const position = { x: cX - dropdownBounds.x, y: cY - dropdownBounds.y }
    await dropdown.click({ position, trial: true })
  })
})
