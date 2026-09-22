import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

// Investigates https://github.com/Comfy-Org/ComfyUI_frontend/issues/18441,
// which reports node mode (bypass/mute) resetting to ALWAYS for all nodes
// when switching workflow tabs. Driving the real Ctrl+B/Ctrl+M shortcuts and
// a real tab switch did not reproduce the reset, on current main or on the
// exact v1.53.6 tag the issue names as broken. These tests document that
// current behavior as a regression guard rather than a red repro.
test.describe(
  'Workflow tab switch preserves node mode',
  { tag: '@canvas' },
  () => {
    test('bypassed node stays bypassed after switching workflow tabs and back', async ({
      comfyPage
    }) => {
      const node = await comfyPage.nodeOps.getFirstNodeRef()
      expect(
        node,
        'default workflow should have at least one node'
      ).toBeTruthy()

      await node!.click('title')
      await comfyPage.keyboard.bypass()
      await expect(node!).toBeBypassed()

      const topbar = comfyPage.menu.topbar
      await topbar.newWorkflowButton.click()
      await expect.poll(() => topbar.getTabNames()).toHaveLength(2)

      await topbar.getTab(0).click()
      await expect(topbar.getActiveTab()).not.toContainText('(2)')

      await expect(node!).toBeBypassed()
    })

    test('muted node stays muted after switching workflow tabs and back', async ({
      comfyPage
    }) => {
      const node = await comfyPage.nodeOps.getFirstNodeRef()
      expect(
        node,
        'default workflow should have at least one node'
      ).toBeTruthy()

      await node!.click('title')
      await comfyPage.keyboard.ctrlSend('KeyM')
      await expect
        .poll(() => node!.getProperty<number>('mode'))
        .toBe(2 /* LGraphEventMode.NEVER (mute) */)

      const topbar = comfyPage.menu.topbar
      await topbar.newWorkflowButton.click()
      await expect.poll(() => topbar.getTabNames()).toHaveLength(2)

      await topbar.getTab(0).click()
      await expect(topbar.getActiveTab()).not.toContainText('(2)')

      await expect
        .poll(() => node!.getProperty<number>('mode'))
        .toBe(2 /* LGraphEventMode.NEVER (mute) */)
    })
  }
)
