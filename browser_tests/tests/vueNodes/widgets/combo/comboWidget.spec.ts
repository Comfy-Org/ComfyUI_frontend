import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import type { Locator } from '@playwright/test'

test.describe('Vue Combo Widget', { tag: '@vue-nodes' }, () => {
  async function openSamplerDropdown(comfyPage: ComfyPage) {
    await comfyPage.workflow.loadWorkflow('vueNodes/linked-int-widget')

    const samplerCombo = comfyPage.vueNodes
      .getNodeByTitle('KSampler')
      .getByRole('combobox', { name: 'sampler_name', exact: true })

    await samplerCombo.click()

    const viewport = comfyPage.page.getByTestId(
      'widget-select-default-viewport'
    )
    await expect(viewport).toBeVisible()

    return viewport
  }

  async function pressDropdownScrollbar(
    comfyPage: ComfyPage,
    viewport: Locator
  ) {
    const box = await viewport.boundingBox()
    if (!box) {
      throw new Error('Widget select viewport is not visible')
    }

    await comfyPage.page.mouse.move(box.x + box.width - 2, box.y + 20)
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

  async function expectWheelScrollsDropdownWithoutMovingCanvas(
    comfyPage: ComfyPage,
    viewport: Locator
  ) {
    const canvasViewportBefore = await getCanvasViewport(comfyPage)
    const scrollBefore = await viewport.evaluate((el) => el.scrollTop)

    await viewport.hover()
    await comfyPage.page.mouse.wheel(0, 500)

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

  test('preserves dropdown scroll capture when switching between node widgets', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('groups/mixed_graph_items')
    await comfyPage.vueNodes.waitForNodes(2)

    const nodes = comfyPage.vueNodes.getNodeByTitle('KSampler')
    const firstSamplerCombo = nodes
      .nth(0)
      .getByRole('combobox', { name: 'sampler_name', exact: true })
    const secondSamplerCombo = nodes
      .nth(2)
      .getByRole('combobox', { name: 'sampler_name', exact: true })

    await firstSamplerCombo.click()

    const viewport = comfyPage.page.getByTestId(
      'widget-select-default-viewport'
    )
    await expect(viewport).toBeVisible()
    await expectWheelScrollsDropdownWithoutMovingCanvas(comfyPage, viewport)

    await pressDropdownScrollbar(comfyPage, viewport)
    await expect(viewport).toBeVisible()

    await expectWheelScrollsDropdownWithoutMovingCanvas(comfyPage, viewport)

    await secondSamplerCombo.click()
    await expect(
      comfyPage.page.getByTestId('widget-select-default-viewport')
    ).toHaveCount(1)

    const secondViewport = comfyPage.page.getByTestId(
      'widget-select-default-viewport'
    )
    await expect(secondViewport).toBeVisible()

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
})
