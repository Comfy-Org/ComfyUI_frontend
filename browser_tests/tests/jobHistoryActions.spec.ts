import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'

test.describe('Job History Actions', { tag: '@ui' }, () => {
  test.use({
    initialSettings: {
      'Comfy.Queue.QPOV2': false,
      'Comfy.Queue.ShowRunProgressBar': true
    }
  })

  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.queuePanel.overlayToggle.click()
  })

  test('opens settings and explains what clearing history preserves', async ({
    comfyPage
  }) => {
    const panel = comfyPage.queuePanel
    await panel.moreOptionsButton.click()
    await expect(panel.dockedHistoryAction).not.toBeChecked()
    await expect(panel.runProgressAction).toBeChecked()
    await expect(panel.clearHistoryAction).toHaveAccessibleDescription(
      "Media assets won't be deleted."
    )
  })

  test('docking history closes the menu', async ({ comfyPage }) => {
    const panel = comfyPage.queuePanel
    await panel.moreOptionsButton.click()
    await panel.dockedHistoryAction.click()
    await expect(panel.menu).toBeHidden()
    await expect
      .poll(() => comfyPage.settings.getSetting('Comfy.Queue.QPOV2'))
      .toBe(true)
  })

  test('keyboard toggles run progress without closing the menu', async ({
    comfyPage
  }) => {
    const panel = comfyPage.queuePanel
    await panel.moreOptionsButton.focus()
    await panel.moreOptionsButton.press('ArrowDown')
    await expect(panel.dockedHistoryAction).toBeFocused()
    await panel.dockedHistoryAction.press('ArrowDown')
    await expect(panel.runProgressAction).toBeFocused()
    await panel.runProgressAction.press('Enter')
    await expect(panel.runProgressAction).not.toBeChecked()
    await expect
      .poll(() =>
        comfyPage.settings.getSetting('Comfy.Queue.ShowRunProgressBar')
      )
      .toBe(false)
    await panel.runProgressAction.press('Escape')
    await expect(panel.menu).toBeHidden()
    await expect(panel.moreOptionsButton).toBeFocused()
  })

  for (const { control, initial, selected } of [
    {
      control: 'filterButton',
      initial: 'All workflows',
      selected: 'Current workflow'
    },
    {
      control: 'sortButton',
      initial: 'Most recent',
      selected: 'Total generation time (longest first)'
    }
  ] as const) {
    test(`${control} selects one option and closes`, async ({ comfyPage }) => {
      const panel = comfyPage.queuePanel
      await panel[control].click()
      await expect(panel.menuOption(initial)).toBeChecked()
      await panel.menuOption(selected).click()
      await expect(panel.menu).toBeHidden()
      await expect(panel[control]).toBeFocused()
      await panel[control].click()
      await expect(panel.menuOption(selected)).toBeChecked()
      await expect(panel.menuOption(initial)).not.toBeChecked()
    })
  }
})
