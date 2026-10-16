import type { AgentRunMode, JobsListResponse } from '@comfyorg/ingest-types'
import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { ModelFolderInfo } from '@/platform/assets/schemas/assetSchema'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

// FE-1969: the thread's stored transcript is what names the workflow a
// reloaded page was bound to, and restoring that target reopens its tab and
// repaints the picker. The panel therefore LOOKS attached after a reload, so a
// host edit that reaches nobody is invisible to the user until they send
// another message - and while a turn is running they cannot.
//
// The sibling case where the page has no stored transcript to restore from,
// and the user reattaches by hand, is `agentFollowerReloadBinding.spec.ts`.
test.describe(
  'Agent follower after a restored-target reload',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.use({ conversationCase: 'agent-rec-set-widget-existing' })

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

    test('receives a host edit after the transcript restores its workflow, with no new turn', async ({
      agentConversation,
      page
    }, testInfo) => {
      test.setTimeout(90_000)
      await agentConversation.persistSavedWorkflow()
      await agentConversation.runTurns()
      const prompt = agentConversation.vueNodes
        .getNodeLocator('6')
        .getByRole('textbox')
      await agentConversation.topbar.saveWorkflowAs('Restored reload')
      await agentConversation.persistThreadTranscript()

      const subscribesBeforeReload = agentConversation.subscribeCount()
      await page.reload({ waitUntil: 'domcontentloaded' })
      await expect(agentConversation.panel).toBeVisible({ timeout: 30_000 })

      await test.step('the transcript restores the target on its own', async () => {
        await expect(
          agentConversation.panel.getByText('Done.').first()
        ).toBeVisible({ timeout: 30_000 })
        await expect(
          agentConversation.panel.getByRole('button', {
            name: enMessages.agent.switchWorkflow
          })
        ).toHaveText('Restored reload', { timeout: 30_000 })
        await expect(prompt).toBeVisible()
      })

      await test.step('a host edit reaches the canvas without another turn', async () => {
        await expect
          .poll(() => agentConversation.subscribeCount(), { timeout: 30_000 })
          .toBeGreaterThan(subscribesBeforeReload)
        // This value was never saved or recorded, and no turn has been sent
        // since the reload. Only a live subscription restored by the target
        // restoration itself can deliver it.
        agentConversation.pushHostOps([
          {
            op: 'set_widget',
            node_id: 6,
            widget: 'text',
            value: 'host edit after restored reload'
          }
        ])
        await expect(prompt).toHaveValue('host edit after restored reload')
        const afterPath = testInfo.outputPath('after-host-edit.png')
        await page.screenshot({ path: afterPath })
        await testInfo.attach('after-host-edit', {
          path: afterPath,
          contentType: 'image/png'
        })
      })
    })
  }
)
