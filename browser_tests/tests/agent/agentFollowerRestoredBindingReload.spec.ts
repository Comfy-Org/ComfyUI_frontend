import type {
  AgentPostMessageRequest,
  AgentRunMode,
  JobsListResponse
} from '@comfyorg/ingest-types'
import { zAgentPostMessageRequest } from '@comfyorg/ingest-types/zod'
import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { ModelFolderInfo } from '@/platform/assets/schemas/assetSchema'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

const LOCAL_EDIT = 'local edit before automatic restore'

function postedWidgetValues(
  raw: string | null,
  nodeId: number
): unknown[] | undefined {
  const parsed = zAgentPostMessageRequest.safeParse(JSON.parse(raw ?? '{}'))
  expect(parsed.success, 'the posted turn must match the request schema').toBe(
    true
  )
  const body: AgentPostMessageRequest | undefined = parsed.data
  const nodes = body?.draft?.content?.nodes
  if (!Array.isArray(nodes)) return undefined
  const node: unknown = nodes.find(
    (candidate: unknown) =>
      typeof candidate === 'object' &&
      candidate !== null &&
      'id' in candidate &&
      candidate.id === nodeId
  )
  if (typeof node !== 'object' || node === null) return undefined
  return 'widgets_values' in node && Array.isArray(node.widgets_values)
    ? node.widgets_values
    : undefined
}

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
      await agentConversation.persistSavedWorkflow()
      await agentConversation.runTurns()
      const prompt = agentConversation.vueNodes
        .getNodeLocator('6')
        .getByRole('textbox')

      await test.step('edit a widget while the host holds its operation, then save', async () => {
        expect(agentConversation.heldHumanOpCount()).toBe(0)
        await prompt.fill(LOCAL_EDIT)
        await expect
          .poll(() => agentConversation.heldHumanOpCount())
          .toBeGreaterThan(0)
        expect(agentConversation.hostWidgetValue('6', 'text')).not.toBe(
          LOCAL_EDIT
        )
        await agentConversation.topbar.saveWorkflowAs('Restored reload')
        await agentConversation.persistThreadTranscript()
      })

      for (const reload of ['first', 'second']) {
        await page.reload({ waitUntil: 'domcontentloaded' })
        await expect(agentConversation.panel).toBeVisible({ timeout: 30_000 })

        await test.step(`the ${reload} reload restores the target with the saved edit on the canvas`, async () => {
          await expect(
            agentConversation.panel.getByText('Done.').first()
          ).toBeVisible({ timeout: 30_000 })
          await expect(
            agentConversation.panel.getByRole('button', {
              name: enMessages.agent.switchWorkflow
            })
          ).toHaveText('Restored reload', { timeout: 30_000 })
          await expect(prompt).toHaveValue(LOCAL_EDIT)
        })
      }
      const afterPath = testInfo.outputPath('after-restore-saved-edit.png')
      await page.screenshot({ path: afterPath })
      await testInfo.attach('after-restore-saved-edit', {
        path: afterPath,
        contentType: 'image/png'
      })

      await test.step('the next message carries the saved edit to the service, which reconciles the shared document to it', async () => {
        const posted = page.waitForRequest(
          (request) =>
            request.method() === 'POST' &&
            /\/api\/agent\/threads\/[^/]+\/messages$/.test(
              new URL(request.url()).pathname
            )
        )
        await agentConversation.sendPrompt()
        expect(postedWidgetValues((await posted).postData(), 6)).toContain(
          LOCAL_EDIT
        )
      })
    })
  }
)
