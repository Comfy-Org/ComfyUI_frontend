import type { WebSocketRoute } from '@playwright/test'

import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'

test.describe('Workflow tab order', { tag: ['@ui'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.workflow.setupWorkflowsDirectory({})
  })

  test('restores the latest tab order and active tab across two reloads', async ({
    comfyPage
  }) => {
    test.info().annotations.push({
      type: 'qa-case',
      description:
        'QA Desk 1.60 C-03 (retest of 1.59 C-09): tabs restore the latest order'
    })
    const { page } = comfyPage
    const { topbar } = comfyPage.menu
    const activeTab = (name: string) =>
      topbar.getWorkflowTab(name).and(topbar.getActiveTab())
    const nextClientIds: string[] = []
    await page.routeWebSocket(/\/ws(\?|$)/, (socket: WebSocketRoute) => {
      const sid = nextClientIds.shift()
      if (!sid) return
      socket.send(
        JSON.stringify({
          type: 'status',
          data: { status: { exec_info: { queue_remaining: 0 } }, sid }
        })
      )
    })
    const reloadWithNewClientIdLikeCloud = async (sid: string) => {
      nextClientIds.push(sid)
      await comfyPage.workflow.reloadAndWaitForApp()
      await expect
        .poll(
          () => page.evaluate(() => window.app!.api.clientId),
          'Cloud hands every page load a new client id'
        )
        .toBe(sid)
    }

    await test.step('open five saved workflows', async () => {
      await topbar.saveWorkflowAs('tab-a')
      for (const name of ['tab-b', 'tab-c', 'tab-d', 'tab-e']) {
        await topbar.newWorkflowButton.click()
        await topbar.saveWorkflowAs(name)
      }
      await expect
        .poll(() => topbar.getTabNames())
        .toEqual(['tab-a', 'tab-b', 'tab-c', 'tab-d', 'tab-e'])
      await expect(activeTab('tab-e')).toBeVisible()
    })

    await test.step('drag the last tab to the front', async () => {
      await topbar
        .getWorkflowTab('tab-e')
        .dragTo(topbar.getWorkflowTab('tab-a'))
      await expect
        .poll(() => topbar.getTabNames())
        .toEqual(['tab-e', 'tab-a', 'tab-b', 'tab-c', 'tab-d'])
    })

    await test.step('close the tabs to the right of the second tab', async () => {
      await topbar.getWorkflowTab('tab-a').click({ button: 'right' })
      await comfyPage.contextMenu.clickMenuItem('Close Tabs to Right')
      await expect.poll(() => topbar.getTabNames()).toEqual(['tab-e', 'tab-a'])
      await expect(activeTab('tab-e')).toBeVisible()
    })

    await test.step('the first reload restores the same tabs', async () => {
      await reloadWithNewClientIdLikeCloud('cloud-load-1')
      await expect.poll(() => topbar.getTabNames()).toEqual(['tab-e', 'tab-a'])
      await expect(activeTab('tab-e')).toBeVisible()
    })

    await test.step('reorder the tabs again', async () => {
      await topbar
        .getWorkflowTab('tab-a')
        .dragTo(topbar.getWorkflowTab('tab-e'))
      await expect.poll(() => topbar.getTabNames()).toEqual(['tab-a', 'tab-e'])
      await expect(activeTab('tab-a')).toBeVisible()
    })

    await test.step('the second reload restores the latest order', async () => {
      await reloadWithNewClientIdLikeCloud('cloud-load-2')
      await expect.poll(() => topbar.getTabNames()).toEqual(['tab-a', 'tab-e'])
      await expect(activeTab('tab-a')).toBeVisible()
    })
  })
})
