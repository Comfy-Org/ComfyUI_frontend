import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

const TOOLBAR = '[role="toolbar"][aria-label="Canvas Toolbar"]'
const TRIGGER = '[aria-haspopup="menu"][aria-label="Canvas Mode"]'
const MENU = '[role="menu"][aria-label="Canvas Mode"]'
const SELECT_ITEM = '[role="menuitemradio"][aria-label="Select"]'
const HAND_ITEM = '[role="menuitemradio"][aria-label="Hand"]'

const MODES = [
  {
    label: 'Select',
    itemSelector: SELECT_ITEM,
    inactiveItemSelector: HAND_ITEM,
    activateCommand: 'Comfy.Canvas.Unlock',
    isReadOnly: false,
    iconPattern: /lucide--mouse-pointer-2/
  },
  {
    label: 'Hand',
    itemSelector: HAND_ITEM,
    inactiveItemSelector: SELECT_ITEM,
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
      const trigger = comfyPage.page.locator(TOOLBAR).locator(TRIGGER)
      await expect(trigger).toBeVisible()
      await expect(trigger).toHaveAttribute('aria-expanded', 'false')
    })

    for (const mode of MODES) {
      test(`shows ${mode.label}-mode icon on trigger button`, async ({
        comfyPage
      }) => {
        await comfyPage.command.executeCommand(mode.activateCommand)
        await comfyPage.nextFrame()
        const modeIcon = comfyPage.page
          .locator(TRIGGER)
          .locator('i[aria-hidden="true"]')
          .first()
        await expect(modeIcon).toHaveClass(mode.iconPattern)
      })
    }
  })

  test.describe('Popover lifecycle', () => {
    test('opens when trigger is clicked', async ({ comfyPage }) => {
      const trigger = comfyPage.page.locator(TRIGGER)
      await trigger.click()
      await expect(comfyPage.page.locator(MENU)).toBeVisible()
      await expect(trigger).toHaveAttribute('aria-expanded', 'true')
    })

    test('closes when trigger is clicked again', async ({ comfyPage }) => {
      const trigger = comfyPage.page.locator(TRIGGER)
      await trigger.click()
      await expect(comfyPage.page.locator(MENU)).toBeVisible()
      await trigger.click()
      await expect(comfyPage.page.locator(MENU)).not.toBeVisible()
      await expect(trigger).toHaveAttribute('aria-expanded', 'false')
    })

    test('closes after a mode item is selected', async ({ comfyPage }) => {
      await comfyPage.page.locator(TRIGGER).click()
      await expect(comfyPage.page.locator(MENU)).toBeVisible()
      await comfyPage.page.locator(HAND_ITEM).click()
      await expect(comfyPage.page.locator(MENU)).not.toBeVisible()
    })

    test('closes when Escape is pressed', async ({ comfyPage }) => {
      const trigger = comfyPage.page.locator(TRIGGER)
      await trigger.click()
      await expect(comfyPage.page.locator(MENU)).toBeVisible()
      await comfyPage.nextFrame()
      await comfyPage.page.keyboard.press('Escape')
      await expect(comfyPage.page.locator(MENU)).not.toBeVisible()
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
        await comfyPage.page.locator(TRIGGER).click()
        await expect(comfyPage.page.locator(MENU)).toBeVisible()
        await comfyPage.page.locator(mode.itemSelector).click()
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
      await comfyPage.page.locator(TRIGGER).click()
      await expect(comfyPage.page.locator(MENU)).toBeVisible()
      await comfyPage.page.locator(SELECT_ITEM).click()
      await expect.poll(() => comfyPage.canvasOps.isReadOnly()).toBe(false)
    })
  })

  test.describe('ARIA state', () => {
    test('aria-checked marks Select active on default load', async ({
      comfyPage
    }) => {
      await comfyPage.page.locator(TRIGGER).click()
      await expect(comfyPage.page.locator(MENU)).toBeVisible()
      await expect(comfyPage.page.locator(SELECT_ITEM)).toHaveAttribute(
        'aria-checked',
        'true'
      )
      await expect(comfyPage.page.locator(HAND_ITEM)).toHaveAttribute(
        'aria-checked',
        'false'
      )
    })

    test('aria-checked flips after switching to Hand', async ({
      comfyPage
    }) => {
      await comfyPage.page.locator(TRIGGER).click()
      await comfyPage.page.locator(HAND_ITEM).click()
      await comfyPage.page.locator(TRIGGER).click()
      await expect(comfyPage.page.locator(MENU)).toBeVisible()
      await expect(comfyPage.page.locator(HAND_ITEM)).toHaveAttribute(
        'aria-checked',
        'true'
      )
      await expect(comfyPage.page.locator(SELECT_ITEM)).toHaveAttribute(
        'aria-checked',
        'false'
      )
    })

    test('aria-checked reflects mode change from external command', async ({
      comfyPage
    }) => {
      await comfyPage.command.executeCommand('Comfy.Canvas.Lock')
      await comfyPage.nextFrame()
      await comfyPage.page.locator(TRIGGER).click()
      await expect(comfyPage.page.locator(MENU)).toBeVisible()
      await expect(comfyPage.page.locator(HAND_ITEM)).toHaveAttribute(
        'aria-checked',
        'true'
      )
      await expect(comfyPage.page.locator(SELECT_ITEM)).toHaveAttribute(
        'aria-checked',
        'false'
      )
    })

    for (const mode of MODES) {
      test(`tabindex=0 is on the active "${mode.label}" item`, async ({
        comfyPage
      }) => {
        await comfyPage.command.executeCommand(mode.activateCommand)
        await comfyPage.nextFrame()
        await comfyPage.page.locator(TRIGGER).click()
        await expect(comfyPage.page.locator(MENU)).toBeVisible()
        await expect(comfyPage.page.locator(mode.itemSelector)).toHaveAttribute(
          'tabindex',
          '0'
        )
        await expect(
          comfyPage.page.locator(mode.inactiveItemSelector)
        ).toHaveAttribute('tabindex', '-1')
      })
    }
  })

  test.describe('Keyboard navigation', () => {
    test('ArrowDown moves focus from Select to Hand', async ({ comfyPage }) => {
      await comfyPage.page.locator(TRIGGER).click()
      await expect(comfyPage.page.locator(MENU)).toBeVisible()
      await comfyPage.nextFrame()
      await comfyPage.page.keyboard.press('ArrowDown')
      await expect(comfyPage.page.locator(HAND_ITEM)).toBeFocused()
    })

    test('ArrowUp wraps focus from Select to Hand', async ({ comfyPage }) => {
      await comfyPage.page.locator(TRIGGER).click()
      await expect(comfyPage.page.locator(MENU)).toBeVisible()
      await comfyPage.nextFrame()
      await comfyPage.page.keyboard.press('ArrowUp')
      await expect(comfyPage.page.locator(HAND_ITEM)).toBeFocused()
    })

    test('ArrowDown wraps focus from Hand to Select', async ({ comfyPage }) => {
      await comfyPage.command.executeCommand('Comfy.Canvas.Lock')
      await comfyPage.nextFrame()
      await comfyPage.page.locator(TRIGGER).click()
      await expect(comfyPage.page.locator(MENU)).toBeVisible()
      await comfyPage.nextFrame()
      await comfyPage.page.keyboard.press('ArrowDown')
      await expect(comfyPage.page.locator(SELECT_ITEM)).toBeFocused()
    })

    test('Escape closes popover and restores focus to trigger', async ({
      comfyPage
    }) => {
      const trigger = comfyPage.page.locator(TRIGGER)
      await trigger.click()
      await expect(comfyPage.page.locator(MENU)).toBeVisible()
      await comfyPage.nextFrame()
      await comfyPage.page.keyboard.press('ArrowDown')
      await comfyPage.page.keyboard.press('Escape')
      await expect(comfyPage.page.locator(MENU)).not.toBeVisible()
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
        await comfyPage.page.locator(TRIGGER).click()
        await expect(comfyPage.page.locator(MENU)).toBeVisible()
        await comfyPage.nextFrame()
        await expect(comfyPage.page.locator(mode.itemSelector)).toBeFocused()
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
      const modeIcon = comfyPage.page
        .locator(TRIGGER)
        .locator('i[aria-hidden="true"]')
        .first()
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
      const modeIcon = comfyPage.page
        .locator(TRIGGER)
        .locator('i[aria-hidden="true"]')
        .first()
      await expect(modeIcon).toHaveClass(/lucide--mouse-pointer-2/)
    })
  })

  test.describe('Shortcut hint display', () => {
    test('menu items show non-empty keyboard shortcut text', async ({
      comfyPage
    }) => {
      await comfyPage.page.locator(TRIGGER).click()
      await expect(comfyPage.page.locator(MENU)).toBeVisible()
      const selectHint = comfyPage.page.locator(`${SELECT_ITEM} > span`)
      const handHint = comfyPage.page.locator(`${HAND_ITEM} > span`)
      const selectText = await selectHint.textContent()
      const handText = await handHint.textContent()
      expect(
        selectText?.trim().length,
        'Select shortcut hint is empty'
      ).toBeGreaterThan(0)
      expect(
        handText?.trim().length,
        'Hand shortcut hint is empty'
      ).toBeGreaterThan(0)
    })
  })
})
