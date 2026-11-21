import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe('Workflow draft quota recovery', { tag: ['@slow'] }, () => {
  test.use({
    initialSettings: { 'Comfy.Workflow.Persist': true }
  })

  test('preserves existing drafts and accepts a later draft after quota pressure', async ({
    comfyPage
  }) => {
    test.setTimeout(60_000)

    const topbar = comfyPage.menu.topbar
    let originalTabNames: string[] = []

    await test.step('create 33 unsaved workflows', async () => {
      await topbar.openBlankWorkflows(32)
      await topbar.getTab(0).click()
      await comfyPage.workflow.waitForWorkflowIdle()
      await expect
        .poll(() => comfyPage.workflow.getDraftWorkflows())
        .toHaveLength(33)

      originalTabNames = await topbar.getTabNames()
      expect(originalTabNames).toHaveLength(33)
      expect(originalTabNames.at(-1)).toBe('Unsaved Workflow (33)')
    })

    await test.step('fail the next workflow draft payload write', async () => {
      await comfyPage.page.evaluate(() => {
        const setItem = Storage.prototype.setItem
        let failNextDraftPayload = true

        Storage.prototype.setItem = function (key, value) {
          if (
            failNextDraftPayload &&
            key.startsWith('Comfy.Workflow.Draft.v2:')
          ) {
            failNextDraftPayload = false
            Reflect.set(window, 'workflowDraftQuotaFaultFired', true)
            throw new DOMException('Quota exceeded', 'QuotaExceededError')
          }

          setItem.call(this, key, value)
        }
      })

      await topbar.getTab(1).click()
      await expect
        .poll(() =>
          comfyPage.page.evaluate(() =>
            Reflect.get(window, 'workflowDraftQuotaFaultFired')
          )
        )
        .toBe(true)
    })

    await test.step('restore all 33 existing drafts after reload', async () => {
      await comfyPage.workflow.reloadAndWaitForApp()

      await expect.poll(() => topbar.getTabNames()).toEqual(originalTabNames)
      await expect(topbar.tabs).toHaveCount(33)
    })

    await test.step('save a later unsaved workflow after the fault clears', async () => {
      await topbar.newWorkflowButton.click()
      await expect(topbar.tabs).toHaveCount(34)
      await expect(topbar.getActiveTab()).toContainText('Unsaved Workflow (34)')
      await topbar.getTab(0).click()
      await comfyPage.workflow.waitForWorkflowIdle()
      await expect
        .poll(() => comfyPage.workflow.getDraftWorkflows())
        .toHaveLength(34)
    })

    await test.step('restore all 34 drafts after another reload', async () => {
      const recoveredTabNames = await topbar.getTabNames()

      await comfyPage.workflow.reloadAndWaitForApp()

      await expect.poll(() => topbar.getTabNames()).toEqual(recoveredTabNames)
      await expect(topbar.tabs).toHaveCount(34)
    })
  })
})
