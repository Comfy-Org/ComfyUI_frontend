import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe('FormDropdown Position Under CSS Transforms', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.workflow.loadWorkflow('widgets/load_image_widget')
    await comfyPage.vueNodes.waitForNodes()
  })

  /**
   * Click the FormDropdown trigger button inside the LoadImage node.
   * The trigger is a button with a chevron icon inside the dropdown widget.
   */
  async function clickDropdownTrigger(
    comfyPage: Parameters<Parameters<typeof test>[2]>[0]['comfyPage']
  ) {
    const node = comfyPage.vueNodes.getNodeByTitle('Load Image')
    const trigger = node.locator('button').filter({
      has: comfyPage.page.locator('.icon-\\[lucide--chevron-down\\]')
    })
    await trigger.click()
  }

  function getDropdownContent(
    comfyPage: Parameters<Parameters<typeof test>[2]>[0]['comfyPage']
  ) {
    return comfyPage.page.getByTestId('form-dropdown-content')
  }

  function getTriggerButton(
    comfyPage: Parameters<Parameters<typeof test>[2]>[0]['comfyPage']
  ) {
    const node = comfyPage.vueNodes.getNodeByTitle('Load Image')
    return node.locator('button').filter({
      has: comfyPage.page.locator('.icon-\\[lucide--chevron-down\\]')
    })
  }

  test('dropdown menu appears near trigger at default zoom', async ({
    comfyPage
  }) => {
    await clickDropdownTrigger(comfyPage)

    const menu = getDropdownContent(comfyPage)
    await expect(menu).toBeVisible()

    const trigger = getTriggerButton(comfyPage)
    const triggerBox = await trigger.boundingBox()
    const menuBox = await menu.boundingBox()

    expect(triggerBox).not.toBeNull()
    expect(menuBox).not.toBeNull()

    // Menu should appear below the trigger, within a reasonable gap
    // (side-offset is 8px, plus some tolerance for rounding)
    const gap = menuBox!.y - (triggerBox!.y + triggerBox!.height)
    expect(gap).toBeGreaterThanOrEqual(-2)
    expect(gap).toBeLessThanOrEqual(20)

    // Menu should be horizontally aligned with the trigger
    const horizontalDrift = Math.abs(menuBox!.x - triggerBox!.x)
    expect(horizontalDrift).toBeLessThan(50)
  })

  test('dropdown menu appears near trigger when zoomed out', async ({
    comfyPage
  }) => {
    // Zoom out using mouse wheel (triggers the real CSS transform pipeline)
    await comfyPage.canvasOps.zoom(300, 3)
    await comfyPage.nextFrame()

    // Verify zoom actually changed
    const scale = await comfyPage.canvasOps.getScale()
    expect(scale).toBeLessThan(1)

    await clickDropdownTrigger(comfyPage)

    const menu = getDropdownContent(comfyPage)
    await expect(menu).toBeVisible()

    const trigger = getTriggerButton(comfyPage)
    const triggerBox = await trigger.boundingBox()
    const menuBox = await menu.boundingBox()

    expect(triggerBox).not.toBeNull()
    expect(menuBox).not.toBeNull()

    // Menu should still appear near the trigger, not at viewport origin
    // The bug caused menu to appear at (0, 0) or far from the trigger
    const gap = menuBox!.y - (triggerBox!.y + triggerBox!.height)
    expect(gap).toBeGreaterThanOrEqual(-2)
    expect(gap).toBeLessThanOrEqual(20)
  })

  test('dropdown menu appears near trigger when zoomed in', async ({
    comfyPage
  }) => {
    // Zoom in using mouse wheel
    await comfyPage.canvasOps.zoom(-300, 3)
    await comfyPage.nextFrame()

    const scale = await comfyPage.canvasOps.getScale()
    expect(scale).toBeGreaterThan(1)

    await clickDropdownTrigger(comfyPage)

    const menu = getDropdownContent(comfyPage)
    await expect(menu).toBeVisible()

    const trigger = getTriggerButton(comfyPage)
    const triggerBox = await trigger.boundingBox()
    const menuBox = await menu.boundingBox()

    expect(triggerBox).not.toBeNull()
    expect(menuBox).not.toBeNull()

    const gap = menuBox!.y - (triggerBox!.y + triggerBox!.height)
    expect(gap).toBeGreaterThanOrEqual(-2)
    expect(gap).toBeLessThanOrEqual(20)
  })

  test('dropdown closes on Escape key', async ({ comfyPage }) => {
    await clickDropdownTrigger(comfyPage)

    const menu = getDropdownContent(comfyPage)
    await expect(menu).toBeVisible()

    await comfyPage.page.keyboard.press('Escape')
    await expect(menu).not.toBeVisible()
  })

  test('dropdown closes on click outside', async ({ comfyPage }) => {
    await clickDropdownTrigger(comfyPage)

    const menu = getDropdownContent(comfyPage)
    await expect(menu).toBeVisible()

    // Click on empty canvas area
    await comfyPage.canvasOps.clickEmptySpace()
    await expect(menu).not.toBeVisible()
  })
})
