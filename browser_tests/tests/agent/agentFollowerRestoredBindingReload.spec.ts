import type { AgentRunMode, JobsListResponse } from '@comfyorg/ingest-types'
import { expect } from '@playwright/test'

import type { ModelFolderInfo } from '@/platform/assets/schemas/assetSchema'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { RestoredBindingReloadDriver } from '@e2e/tests/agent/agentRestoredBindingReloadDriver'

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
      const reload = new RestoredBindingReloadDriver(page, agentConversation)
      await agentConversation.persistSavedWorkflow()
      await agentConversation.runTurns()
      const prompt = agentConversation.vueNodes
        .getNodeLocator('6')
        .getByRole('textbox')
      await agentConversation.topbar.saveWorkflowAs('Restored reload')
      await reload.persistThreadTranscript()

      const subscribesBeforeReload = agentConversation.subscribeCount()

      await test.step('the transcript restores the target on its own', async () => {
        await reload.reloadIntoRestoredTarget('Restored reload')
        await expect(prompt).toBeVisible()
      })

      await test.step('a never-saved, never-recorded host edit reaches the canvas with no turn sent since the reload, so only a live subscription can be delivering it', async () => {
        await expect
          .poll(() => agentConversation.subscribeCount(), { timeout: 30_000 })
          .toBeGreaterThan(subscribesBeforeReload)
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

    test('keeps a saved edit the shared document never received, and posts it with the next message', async ({
      agentConversation,
      page
    }, testInfo) => {
      test.setTimeout(90_000)
      const reload = new RestoredBindingReloadDriver(page, agentConversation)
      await agentConversation.persistSavedWorkflow()
      await agentConversation.runTurns()
      const prompt = agentConversation.vueNodes
        .getNodeLocator('6')
        .getByRole('textbox')

      await test.step('edit a widget while the host holds its operation, then save', async () => {
        expect(agentConversation.heldHumanOpCount()).toBe(0)
        await prompt.fill('local edit before automatic restore')
        await expect
          .poll(() => agentConversation.heldHumanOpCount())
          .toBeGreaterThan(0)
        expect(agentConversation.hostWidgetValue('6', 'text')).not.toBe(
          'local edit before automatic restore'
        )
        await agentConversation.topbar.saveWorkflowAs('Restored reload')
        await reload.persistThreadTranscript()
      })

      await test.step('the first reload restores the target with the saved edit on the canvas', async () => {
        await reload.reloadIntoRestoredTarget('Restored reload')
        await expect(prompt).toHaveValue('local edit before automatic restore')
      })

      await test.step('the second reload still restores the target with the saved edit', async () => {
        await reload.reloadIntoRestoredTarget('Restored reload')
        await expect(prompt).toHaveValue('local edit before automatic restore')
      })

      const afterPath = testInfo.outputPath('after-restore-saved-edit.png')
      await page.screenshot({ path: afterPath })
      await testInfo.attach('after-restore-saved-edit', {
        path: afterPath,
        contentType: 'image/png'
      })

      await test.step('the next message carries the saved edit to the service, which reconciles the shared document to it', async () => {
        const posted = reload.nextPostedDraftWidgetValues(6)
        await agentConversation.sendPrompt()
        expect(await posted).toContain('local edit before automatic restore')
      })
    })
  }
)
