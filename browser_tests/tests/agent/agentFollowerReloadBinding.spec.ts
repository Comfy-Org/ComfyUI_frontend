import type { AgentRunMode, JobsListResponse } from '@comfyorg/ingest-types'
import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { ModelFolderInfo } from '@/platform/assets/schemas/assetSchema'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

// Explicit reattachment after navigation, not automatic restoration of the old
// page-session binding. See https://github.com/Comfy-Org/ComfyUI_frontend/pull/16849
test.describe(
  'Agent saved-workflow reattachment',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.use({
      conversationCase: 'agent-rec-set-widget-existing',
      humanOpsHost: 'apply'
    })

    test.beforeEach(async ({ page }) => {
      const folders: ModelFolderInfo[] = []
      await page.route('**/api/experiment/models', (route) =>
        route.fulfill(jsonRoute(folders))
      )
      const jobs: JobsListResponse = {
        jobs: [],
        pagination: { offset: 0, limit: 200, total: 0, has_more: false }
      }
      await page.route('**/api/jobs?*', (route) =>
        route.fulfill(jsonRoute(jobs))
      )
      const runMode: AgentRunMode = { mode: 'ask_approval', credit_limit: null }
      await page.route('**/api/agent/run-mode', (route) => {
        if (route.request().method() !== 'GET') return route.fallback()
        return route.fulfill(jsonRoute(runMode))
      })
    })

    test('reloads a saved workflow and receives a fresh host edit after a new turn', async ({
      agentConversation,
      page
    }, testInfo) => {
      test.setTimeout(90_000)
      await agentConversation.persistSavedWorkflow()
      await agentConversation.runTurns()
      const prompt = agentConversation.vueNodes
        .getNodeLocator('6')
        .getByRole('textbox')
      await prompt.fill('saved before reload')
      await agentConversation.topbar.saveWorkflowAs('Reload reattachment')
      const beforePath = testInfo.outputPath('before-reload.png')
      await page.screenshot({ path: beforePath })
      await testInfo.attach('before-reload', {
        path: beforePath,
        contentType: 'image/png'
      })
      const subscribesBeforeReload = agentConversation.subscribeCount()

      const restoredContent = page.waitForResponse(
        (response) =>
          response.request().method() === 'GET' &&
          decodeURIComponent(new URL(response.url()).pathname) ===
            '/api/userdata/workflows/Reload reattachment.json',
        { timeout: 60_000 }
      )
      await page.reload({ waitUntil: 'domcontentloaded' })
      await expect(agentConversation.panel).toBeVisible({ timeout: 30_000 })
      const picker = agentConversation.panel.getByRole('button', {
        name: enMessages.agent.switchWorkflow
      })
      await picker.click()
      await page
        .getByRole('menuitemradio', {
          name: 'Reload reattachment',
          exact: true
        })
        .click()
      await expect(picker).toHaveText('Reload reattachment')
      expect((await restoredContent).ok()).toBe(true)
      await expect(prompt).toHaveValue('saved before reload')
      await agentConversation.sendPrompt()
      await expect
        .poll(() => agentConversation.subscribeCount())
        .toBe(subscribesBeforeReload + 1)

      // This value was never saved or recorded. Only the post-reload live
      // subscription can deliver it; a stale local canvas cannot satisfy it.
      agentConversation.pushHostOps([
        {
          op: 'set_widget',
          node_id: 6,
          widget: 'text',
          value: 'fresh host edit after reload'
        }
      ])
      await expect(prompt).toHaveValue('fresh host edit after reload')
      const afterPath = testInfo.outputPath('after-host-edit.png')
      await page.screenshot({ path: afterPath })
      await testInfo.attach('after-host-edit', {
        path: afterPath,
        contentType: 'image/png'
      })
    })
  }
)
