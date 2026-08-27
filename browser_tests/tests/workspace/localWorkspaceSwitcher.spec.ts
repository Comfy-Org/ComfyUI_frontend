import { expect } from '@playwright/test'

import {
  PERSONAL_WORKSPACE_NAME,
  TEAM_WORKSPACE_NAME
} from '@e2e/fixtures/data/workspaceSwitcher'
import { workspaceSwitcherTest as test } from '@e2e/fixtures/workspaceSwitcherFixture'

test.describe('Local workspace switcher', { tag: '@auth' }, () => {
  test.describe.configure({ timeout: 60_000 })

  test('switches the active workspace without reloading or losing the workflow', async ({
    comfyPage
  }) => {
    const page = comfyPage.page
    const localOrigin = new URL(page.url()).origin
    const billingRequestUrls: string[] = []
    const localBillingRequestUrls: string[] = []
    const billingAuthorizationHeaders: string[] = []
    let tokenRequestBody: unknown

    page.on('request', (request) => {
      if (!request.url().includes('/api/billing/')) return
      billingRequestUrls.push(request.url())
      billingAuthorizationHeaders.push(request.headers().authorization ?? '')
      if (new URL(request.url()).origin === localOrigin) {
        localBillingRequestUrls.push(request.url())
      }
    })
    page.on('request', (request) => {
      if (
        request.method() === 'POST' &&
        request.url().endsWith('/api/auth/token')
      ) {
        tokenRequestBody = request.postDataJSON()
      }
    })

    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.settings.setSetting(
      'Comfy.Workflow.WorkflowTabsPosition',
      'Topbar'
    )
    const workflowName = `local-workspace-${Date.now().toString(36)}`
    await comfyPage.menu.topbar.saveWorkflow(workflowName)
    await page.evaluate(() => {
      document.body.dataset.workspaceSwitchDocument = 'original'
    })

    await comfyPage.toast.closeToasts()
    await page.getByRole('button', { name: 'Current user' }).click()
    await expect(page.getByRole('button', { name: 'Subscribe' })).toHaveCount(0)
    await expect(page.getByTestId('workspace-switcher-trigger')).toContainText(
      PERSONAL_WORKSPACE_NAME
    )
    await page.getByTestId('workspace-switcher-trigger').click()

    const panel = page.getByTestId('workspace-switcher-panel')
    await expect(panel.getByText(PERSONAL_WORKSPACE_NAME)).toBeVisible()
    await expect(panel.getByText(TEAM_WORKSPACE_NAME)).toBeVisible()
    await expect(panel.getByText('Owner')).toHaveCount(2)
    await expect(panel.getByText('Member')).toHaveCount(1)
    const scopeCaption = panel.getByText(
      'Workspaces only affect which credits you use.'
    )
    await expect(scopeCaption).toBeVisible()
    await scopeCaption.locator('..').locator('.pi-info-circle').hover()
    await expect(page.getByRole('tooltip')).toHaveText(
      'Runs that use partner nodes spend credits from this workspace. Unlike on Cloud, every workspace saves to your usual output folder.'
    )

    await panel.getByText(TEAM_WORKSPACE_NAME, { exact: true }).click()

    await expect(page.getByTestId('workspace-switcher-trigger')).toContainText(
      TEAM_WORKSPACE_NAME
    )
    await expect(page.getByRole('button', { name: 'Subscribe' })).toHaveCount(0)
    await expect.poll(() => billingRequestUrls.length).toBeGreaterThan(0)
    expect(tokenRequestBody).toEqual({ workspace_id: 'ws-team' })
    expect(billingRequestUrls).toEqual(
      expect.arrayContaining([
        expect.stringMatching(
          /^https:\/\/testcloud\.comfy\.org\/api\/billing\//
        )
      ])
    )
    expect(localBillingRequestUrls).toEqual([])
    await expect
      .poll(() => billingAuthorizationHeaders)
      .toContain('Bearer mock-workspace-token-ws-team')
    await expect
      .poll(() => comfyPage.menu.topbar.getTabNames())
      .toContain(workflowName)
    expect(
      await page.evaluate(() => document.body.dataset.workspaceSwitchDocument)
    ).toBe('original')
  })

  test('Run button queues while the workspace has no active subscription', async ({
    comfyPage
  }) => {
    const page = comfyPage.page
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.workflow.loadWorkflow('default')
    await comfyPage.toast.closeToasts()

    const promptRequest = page.waitForRequest(
      (request) =>
        request.method() === 'POST' &&
        new URL(request.url()).pathname.endsWith('/api/prompt')
    )
    await comfyPage.runButton.click()

    expect((await promptRequest).postDataJSON()).toEqual(
      expect.objectContaining({ prompt: expect.anything() })
    )
  })

  test('queues with the target workspace after a delayed switch', async ({
    comfyPage,
    workspaceSwitchTokenGate
  }) => {
    const page = comfyPage.page
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.workflow.loadWorkflow('default')
    await comfyPage.toast.closeToasts()
    await page.getByRole('button', { name: 'Current user' }).click()
    await page.getByTestId('workspace-switcher-trigger').click()
    const promptRequest = page.waitForRequest(
      (request) =>
        request.method() === 'POST' &&
        new URL(request.url()).pathname.endsWith('/api/prompt')
    )

    await page
      .getByTestId('workspace-switcher-panel')
      .getByText(TEAM_WORKSPACE_NAME, { exact: true })
      .click()
    await workspaceSwitchTokenGate.requestReceived
    await page.evaluate(() => {
      void window.app!.queuePrompt(0)
    })
    workspaceSwitchTokenGate.release()

    expect((await promptRequest).postDataJSON()).toEqual(
      expect.objectContaining({
        extra_data: expect.objectContaining({
          auth_token_comfy_org: 'mock-workspace-token-ws-team'
        })
      })
    )
  })
})
