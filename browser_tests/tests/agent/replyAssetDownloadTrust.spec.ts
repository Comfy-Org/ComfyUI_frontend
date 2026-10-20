import { expect } from '@playwright/test'
import type {
  AgentMessage,
  AgentRunMode,
  AgentThreadListResponse
} from '@comfyorg/ingest-types'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { StorageKeys } from '@/platform/workflow/persistence/base/storageKeys'
import {
  agentTest as test,
  bootAgentApp
} from '@e2e/fixtures/agentPanelFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

test.describe(
  'Agent reply asset download trust boundary',
  {
    tag: ['@cloud', '@ui']
  },
  () => {
    let cookieByAsset: Map<string, string | null>
    let downloads: string[]

    test.beforeEach(async ({ page, agentFlagEnabled }) => {
      await bootAgentApp(page, agentFlagEnabled)

      const threadId = '4efb615c-b3fd-4cdc-8767-38c2b44d2cec'
      const urls = [
        '/api/view?filename=trusted.png',
        '/api/system_stats?filename=untrusted.png',
        'https://evil.example/api/view?filename=hostile.png'
      ]
      const messages: AgentMessage[] = [
        {
          id: 'reply',
          thread_id: threadId,
          turn_id: 'download-turn',
          seq: 1,
          role: 'assistant',
          status: 'complete',
          content: { text: urls.map((url) => `![Asset](${url})`).join('\n\n') }
        }
      ]
      const threads: AgentThreadListResponse = {
        threads: [
          {
            created_at: '2026-09-01T00:00:00Z',
            id: threadId,
            last_message_at: '2026-09-01T00:00:00Z',
            message_count: messages.length,
            preview: 'Reply assets',
            status: 'active',
            title: 'Reply assets',
            updated_at: '2026-09-01T00:00:00Z',
            workflow_id: ''
          }
        ],
        pagination: { has_more: false, limit: 100, offset: 0, total: 1 }
      }
      const runMode: AgentRunMode = { mode: 'ask_approval', credit_limit: null }
      await page.route('**/api/experiment/models', (route) =>
        route.fulfill(jsonRoute([]))
      )
      await page.route('**/api/agent/threads?*', (route) =>
        route.fulfill(jsonRoute(threads))
      )
      await page.route('**/api/agent/run-mode', (route) =>
        route.fulfill(jsonRoute(runMode))
      )
      await page.route(`**/api/agent/threads/${threadId}/messages`, (route) =>
        route.fulfill(jsonRoute(messages))
      )
      await page.addInitScript(({ key, id }) => localStorage.setItem(key, id), {
        key: StorageKeys.agentThread('personal'),
        id: threadId
      })
      cookieByAsset = new Map<string, string | null>()
      downloads = []
      page.on('download', (download) =>
        downloads.push(download.suggestedFilename())
      )
      await page.context().addCookies([
        {
          name: 'session',
          value: 'test-session',
          url: new URL(page.url()).origin
        }
      ])
      await page.route(
        /\/api\/(view|system_stats)\?filename=(trusted|untrusted|hostile)\.png/,
        async (route) => {
          if (route.request().resourceType() === 'fetch') {
            const asset = new URL(route.request().url()).searchParams.get(
              'filename'
            )
            if (asset) {
              cookieByAsset.set(
                asset,
                await route.request().headerValue('cookie')
              )
            }
          }
          await route.fulfill({ body: 'asset', contentType: 'image/png' })
        }
      )
      await page.reload()
    })

    test('keeps authentication on the trusted view route only', async ({
      page
    }) => {
      const panel = await new AgentPanel(page).open()
      const downloadButton = panel.getByRole('button', {
        name: enMessages.agent.downloadAssets,
        exact: true
      })
      await expect(downloadButton).toBeVisible()
      await downloadButton.click()

      await expect
        .poll(() => [...downloads].sort())
        .toEqual(['hostile.png', 'trusted.png', 'untrusted.png'])

      expect([...cookieByAsset.keys()].sort()).toEqual([
        'hostile.png',
        'trusted.png',
        'untrusted.png'
      ])
      expect(cookieByAsset.get('trusted.png')).toContain('session=test-session')
      expect(cookieByAsset.get('untrusted.png')).toBeNull()
      expect(cookieByAsset.get('hostile.png')).toBeNull()
    })
  }
)
