import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

const getLocators = (page: Page) => ({
  trigger: page.getByRole('button', { name: 'Canvas Mode' }),
  menu: page.getByRole('menu', { name: 'Canvas Mode' }),
  selectItem: page.getByRole('menuitemradio', { name: 'Select' }),
  handItem: page.getByRole('menuitemradio', { name: 'Hand' })
})

const MODES = [
  {
    label: 'Select',
    activateCommand: 'Comfy.Canvas.Unlock',
    isReadOnly: false,
    iconPattern: /lucide--mouse-pointer-2/
  },
  {
    label: 'Hand',
    activateCommand: 'Comfy.Canvas.Lock',
    isReadOnly: true,
    iconPattern: /lucide--hand/
  }
]

test.describe('CanvasModeSelector', { tag: '@canvas' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.Graph.CanvasMenu', true)
    await comfyPage.command.executeCommand('Comfy.Canvas.Unlock')
    await comfyPage.nextFrame()
  })

  test.describe('Trigger button', () => {
    test('visible in canvas toolbar with ARIA markup', async ({
      comfyPage
    }) => {
      const { trigger } = getLocators(comfyPage.page)
      await expect(trigger).toBeVisible()
      await expect(trigger).toHaveAttribute('aria-expanded', 'false')
    })

    for (const mode of MODES) {
      test(`shows ${mode.label}-mode icon on trigger button`, async ({
        comfyPage
      }) => {
        await comfyPage.command.executeCommand(mode.activateCommand)
        await comfyPage.nextFrame()
        const { trigger } = getLocators(comfyPage.page)
        const modeIcon = trigger.locator('i[aria-hidden="true"]').first()
        await expect(modeIcon).toHaveClass(mode.iconPattern)
      })
    }
  })

  test.describe('Popover lifecycle', () => {
    test('opens when trigger is clicked', async ({ comfyPage }) => {
      const { trigger, menu } = getLocators(comfyPage.page)
      await trigger.click()
      await comfyPage.nextFrame()
      await expect(menu).toBeVisible()
      await expect(trigger).toHaveAttribute('aria-expanded', 'true')
    })

    test('closes when trigger is clicked again', async ({ comfyPage }) => {
      const { trigger, menu } = getLocators(comfyPage.page)
      await trigger.click()
      await comfyPage.nextFrame()
      await expect(menu).toBeVisible()
      await trigger.click()
      await comfyPage.nextFrame()
      await expect(menu).toBeHidden()
      await expect(trigger).toHaveAttribute('aria-expanded', 'false')
    })

    test('closes after a mode item is selected', async ({ comfyPage }) => {
      const { trigger, menu, handItem } = getLocators(comfyPage.page)
      await trigger.click()
      await comfyPage.nextFrame()
      await expect(menu).toBeVisible()
      await handItem.click()
      await comfyPage.nextFrame()
      await expect(menu).toBeHidden()
    })

    test('closes when Escape is pressed', async ({ comfyPage }) => {
      const { trigger, menu, selectItem } = getLocators(comfyPage.page)
      await trigger.click()
      await comfyPage.nextFrame()
      await expect(menu).toBeVisible()
      await selectItem.press('Escape')
      await comfyPage.nextFrame()
      await expect(menu).toBeHidden()
      await expect(trigger).toHaveAttribute('aria-expanded', 'false')
    })
  })

  test.describe('Mode switching', () => {
    for (const mode of MODES) {
      test(`clicking "${mode.label}" sets canvas readOnly=${mode.isReadOnly}`, async ({
        comfyPage
      }) => {
        if (!mode.isReadOnly) {
          await comfyPage.command.executeCommand('Comfy.Canvas.Lock')
          await comfyPage.nextFrame()
        }
        const { trigger, menu, selectItem, handItem } = getLocators(
          comfyPage.page
        )
        const item = mode.isReadOnly ? handItem : selectItem
        await trigger.click()
        await comfyPage.nextFrame()
        await expect(menu).toBeVisible()
        await item.click()
        await comfyPage.nextFrame()
        await expect
          .poll(() => comfyPage.canvasOps.isReadOnly())
          .toBe(mode.isReadOnly)
      })
    }

    test('clicking the currently active item is a no-op', async ({
      comfyPage
    }) => {
      expect(
        await comfyPage.canvasOps.isReadOnly(),
        'Precondition: canvas starts in Select mode'
      ).toBe(false)
      const { trigger, menu, selectItem } = getLocators(comfyPage.page)
      await trigger.click()
      await comfyPage.nextFrame()
      await expect(menu).toBeVisible()
      await selectItem.click()
      await comfyPage.nextFrame()
      await expect.poll(() => comfyPage.canvasOps.isReadOnly()).toBe(false)
    })
  })

  test.describe('ARIA state', () => {
    test('aria-checked marks Select active on default load', async ({
      comfyPage
    }) => {
      const { trigger, menu, selectItem, handItem } = getLocators(
        comfyPage.page
      )
      await trigger.click()
      await comfyPage.nextFrame()
      await expect(menu).toBeVisible()
      await expect(selectItem).toHaveAttribute('aria-checked', 'true')
      await expect(handItem).toHaveAttribute('aria-checked', 'false')
    })

    for (const mode of MODES) {
      test(`tabindex=0 is on the active "${mode.label}" item`, async ({
        comfyPage
      }) => {
        await comfyPage.command.executeCommand(mode.activateCommand)
        await comfyPage.nextFrame()
        const { trigger, menu, selectItem, handItem } = getLocators(
          comfyPage.page
        )
        await trigger.click()
        await comfyPage.nextFrame()
        await expect(menu).toBeVisible()

        const activeItem = mode.isReadOnly ? handItem : selectItem
        const inactiveItem = mode.isReadOnly ? selectItem : handItem

        await expect(activeItem).toHaveAttribute('tabindex', '0')
        await expect(inactiveItem).toHaveAttribute('tabindex', '-1')
      })
    }
  })

  test.describe('Keyboard navigation', () => {
    test('ArrowDown moves focus from Select to Hand', async ({ comfyPage }) => {
      const { trigger, menu, selectItem, handItem } = getLocators(
        comfyPage.page
      )
      await trigger.click()
      await comfyPage.nextFrame()
      await expect(menu).toBeVisible()
      await selectItem.press('ArrowDown')
      await expect(handItem).toBeFocused()
    })

    test('Escape closes popover and restores focus to trigger', async ({
      comfyPage
    }) => {
      const { trigger, menu, selectItem, handItem } = getLocators(
        comfyPage.page
      )
      await trigger.click()
      await comfyPage.nextFrame()
      await expect(menu).toBeVisible()
      await selectItem.press('ArrowDown')
      await handItem.press('Escape')
      await comfyPage.nextFrame()
      await expect(menu).toBeHidden()
      await expect(trigger).toBeFocused()
    })
  })

  test.describe('Focus management on open', () => {
    for (const mode of MODES) {
      test(`auto-focuses the checked "${mode.label}" item on open`, async ({
        comfyPage
      }) => {
        await comfyPage.command.executeCommand(mode.activateCommand)
        await comfyPage.nextFrame()
        const { trigger, menu, selectItem, handItem } = getLocators(
          comfyPage.page
        )
        const item = mode.isReadOnly ? handItem : selectItem
        await trigger.click()
        await comfyPage.nextFrame()
        await expect(menu).toBeVisible()
        await expect(item).toBeFocused()
      })
    }
  })

  test.describe('Keybinding integration', { tag: '@keyboard' }, () => {
    test("'H' locks canvas and updates trigger icon to Hand", async ({
      comfyPage
    }) => {
      expect(
        await comfyPage.canvasOps.isReadOnly(),
        'Precondition: canvas starts unlocked'
      ).toBe(false)
      await comfyPage.canvas.press('KeyH')
      await comfyPage.nextFrame()
      expect(await comfyPage.canvasOps.isReadOnly()).toBe(true)
      const { trigger } = getLocators(comfyPage.page)
      const modeIcon = trigger.locator('i[aria-hidden="true"]').first()
      await expect(modeIcon).toHaveClass(/lucide--hand/)
    })

    test("'V' unlocks canvas and updates trigger icon to Select", async ({
      comfyPage
    }) => {
      await comfyPage.command.executeCommand('Comfy.Canvas.Lock')
      await comfyPage.nextFrame()
      expect(
        await comfyPage.canvasOps.isReadOnly(),
        'Precondition: canvas starts locked'
      ).toBe(true)
      await comfyPage.canvas.press('KeyV')
      await comfyPage.nextFrame()
      expect(await comfyPage.canvasOps.isReadOnly()).toBe(false)
      const { trigger } = getLocators(comfyPage.page)
      const modeIcon = trigger.locator('i[aria-hidden="true"]').first()
      await expect(modeIcon).toHaveClass(/lucide--mouse-pointer-2/)
    })
  })

  test.describe('Shortcut hint display', () => {
    test('menu items show non-empty keyboard shortcut text', async ({
      comfyPage
    }) => {
      const { trigger, menu, selectItem, handItem } = getLocators(
        comfyPage.page
      )
      await trigger.click()
      await comfyPage.nextFrame()
      await expect(menu).toBeVisible()
      const selectHint = selectItem.getByTestId('shortcut-hint')
      const handHint = handItem.getByTestId('shortcut-hint')

      await expect(selectHint).not.toBeEmpty()
      await expect(handHint).not.toBeEmpty()
    })
  })
})
