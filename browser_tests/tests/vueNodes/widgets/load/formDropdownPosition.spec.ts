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

  function getTriggerButton(
    comfyPage: Parameters<Parameters<typeof test>[2]>[0]['comfyPage']
  ) {
    const node = comfyPage.vueNodes.getNodeByTitle('Load Image')
    return node
      .locator('button')
      .filter({
        has: comfyPage.page.locator('.icon-\\[lucide--chevron-down\\]')
      })
      .and(comfyPage.page.locator(':not([data-testid="node-collapse-button"])'))
  }

  async function clickDropdownTrigger(
    comfyPage: Parameters<Parameters<typeof test>[2]>[0]['comfyPage']
  ) {
    await getTriggerButton(comfyPage).click()
  }

  function getDropdownContent(
    comfyPage: Parameters<Parameters<typeof test>[2]>[0]['comfyPage']
  ) {
    return comfyPage.page.getByTestId('form-dropdown-content')
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

  test('dropdown closes on Escape key', async ({ comfyPage }) => {
    await clickDropdownTrigger(comfyPage)

    const menu = getDropdownContent(comfyPage)
    await expect(menu).toBeVisible()

    await comfyPage.page.keyboard.press('Escape')
    await expect(menu).not.toBeVisible()
  })
})
